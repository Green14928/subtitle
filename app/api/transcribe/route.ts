import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import {
  buildPromptFromTerms,
  transcribeOneChunk,
  type Word,
} from "@/lib/openai-transcribe";
import { prepareAudioForTranscribe, safeUnlink } from "@/lib/audio";
import { segmentsToSRT, segmentsToVTT, segmentsToPlainText, type Segment } from "@/lib/srt";
import { buildSegmentsFromWords } from "@/lib/segment-builder";
import { applyDictionary, parseAliases, type TermEntry } from "@/lib/keyword-correct";
import { correctWithLLM } from "@/lib/llm-correct";
import { mkdir, stat } from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import path from "path";
import crypto from "crypto";

export const maxDuration = 300;
export const runtime = "nodejs";

type MatchMode = "loose" | "normal" | "strict";

function parseMatchMode(raw: string | null): MatchMode {
  if (raw === "loose" || raw === "strict") return raw;
  return "normal";
}

export async function POST(req: NextRequest) {
  try {
    const { error, userId } = await requireAuth();
    if (error) return error;

    const fileNameRaw = req.headers.get("x-file-name");
    const categoryIdsRaw = req.headers.get("x-category-ids") || "[]";
    const language = req.headers.get("x-language") || "zh";
    const matchMode = parseMatchMode(req.headers.get("x-match-mode"));

    if (!fileNameRaw) {
      return NextResponse.json({ error: "缺少 X-File-Name header" }, { status: 400 });
    }
    if (!req.body) {
      return NextResponse.json({ error: "沒有檔案內容" }, { status: 400 });
    }

    const fileName = decodeURIComponent(fileNameRaw);
    let categoryIds: string[];
    try {
      categoryIds = JSON.parse(categoryIdsRaw);
    } catch {
      return NextResponse.json({ error: "categoryIds 格式錯誤" }, { status: 400 });
    }

    // 收集詞庫：text + aliases
    const terms = await prisma.term.findMany({
      where: { userId, categoryId: { in: categoryIds } },
      select: { text: true, aliases: true },
    });
    const termEntries: TermEntry[] = terms.map((t) => ({
      text: t.text,
      aliases: parseAliases(t.aliases),
    }));

    // prompt 只用正確拼寫的主詞（alias 不塞 prompt，避免 bias 到錯字）
    const prompt = buildPromptFromTerms(termEntries.map((t) => t.text));

    const uploadsDir = path.join(process.cwd(), "uploads", userId);
    await mkdir(uploadsDir, { recursive: true });

    const token = crypto.randomBytes(16).toString("hex");
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${token}_${safeName}`;
    const filePath = path.join(uploadsDir, storedName);

    const nodeReadable = Readable.fromWeb(req.body as any);
    const writeStream = createWriteStream(filePath);
    try {
      await pipeline(nodeReadable, writeStream);
    } catch (e: any) {
      console.error("[transcribe] stream write failed", e);
      return NextResponse.json(
        { error: `寫檔失敗：${e?.message || String(e)}` },
        { status: 500 }
      );
    }

    const stats = await stat(filePath);
    const fileSize = stats.size;

    const transcription = await prisma.transcription.create({
      data: {
        fileName,
        fileSize,
        language,
        status: "processing",
        progress: 25,
        stage: "上傳完成，準備抽音訊",
        categoryIds: JSON.stringify(categoryIds),
        matchMode,
        promptUsed: prompt,
        userId,
      },
    });

    processTranscription(
      transcription.id,
      filePath,
      uploadsDir,
      token,
      prompt,
      language,
      matchMode,
      termEntries
    ).catch((err) => console.error("Transcription error:", err));

    return NextResponse.json({
      id: transcription.id,
      status: "processing",
      message: "辨識已開始，請稍候",
    });
  } catch (err: any) {
    console.error("[transcribe POST] fatal", err);
    return NextResponse.json(
      { error: `伺服器錯誤：${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}

async function processTranscription(
  id: string,
  inputPath: string,
  workDir: string,
  token: string,
  prompt: string,
  language: string,
  matchMode: MatchMode,
  termEntries: TermEntry[]
) {
  const chunksToCleanup: string[] = [];

  async function setStage(progress: number, stage: string) {
    await prisma.transcription.update({
      where: { id },
      data: { progress, stage },
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[stub] OPENAI_API_KEY 未設定，回傳假資料");
      await setStage(60, "Demo 模式（無 API key）");
      await new Promise((r) => setTimeout(r, 2000));
      const fakeSegments: Segment[] = [
        { start: 0, end: 3, text: "（示範字幕）這是一段測試用的字幕。" },
        { start: 3, end: 7, text: "設定 OPENAI_API_KEY 後就會呼叫真正的 Whisper。" },
      ];
      await prisma.transcription.update({
        where: { id },
        data: {
          status: "completed",
          progress: 100,
          stage: "完成（Demo）",
          srtContent: segmentsToSRT(fakeSegments),
          vttContent: segmentsToVTT(fakeSegments),
          plainText: segmentsToPlainText(fakeSegments),
          rawText: segmentsToPlainText(fakeSegments),
          completedAt: new Date(),
        },
      });
      await safeUnlink(inputPath);
      return;
    }

    await setStage(30, "抽音訊中");
    const chunks = await prepareAudioForTranscribe(inputPath, workDir, token);
    chunksToCleanup.push(...chunks.map((c) => c.path));
    await safeUnlink(inputPath);

    const totalChunks = chunks.length;
    await setStage(
      40,
      totalChunks > 1 ? `準備辨識（音訊切成 ${totalChunks} 段）` : "準備辨識"
    );

    const allWords: Word[] = [];
    const allFallback: Segment[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const base = 40;
      const span = 45; // 40→85 分配給辨識（留 15% 給後校正）
      const before = base + Math.floor((span * i) / totalChunks);
      await setStage(
        before,
        totalChunks > 1 ? `辨識中 (${i + 1}/${totalChunks})` : "辨識中"
      );

      const res = await transcribeOneChunk(chunk, {
        initialPrompt: prompt || undefined,
        language,
      });
      allWords.push(...res.words);
      allFallback.push(...res.segments);
    }

    // word-level 重組字幕 → 時間軸精準
    await setStage(85, "組合時間軸");
    const rebuilt = buildSegmentsFromWords(
      allWords.sort((a, b) => a.start - b.start),
      allFallback.sort((a, b) => a.start - b.start)
    );
    const rawText = rebuilt.map((s) => s.text).join("\n");

    // 套 matchMode 修正
    let finalSegments: Segment[] = rebuilt;
    if (matchMode === "normal" && termEntries.length > 0) {
      await setStage(90, "套用詞庫修正");
      finalSegments = applyDictionary(rebuilt, termEntries);
    } else if (matchMode === "strict" && termEntries.length > 0) {
      await setStage(90, "GPT-4 校正專有名詞");
      finalSegments = await correctWithLLM(rebuilt, termEntries);
    }

    await prisma.transcription.update({
      where: { id },
      data: {
        status: "completed",
        progress: 100,
        stage: "完成",
        srtContent: segmentsToSRT(finalSegments),
        vttContent: segmentsToVTT(finalSegments),
        plainText: segmentsToPlainText(finalSegments),
        rawText,
        completedAt: new Date(),
      },
    });
  } catch (err: any) {
    console.error("[transcribe] failed", err);
    await prisma.transcription.update({
      where: { id },
      data: {
        status: "failed",
        stage: "失敗",
        errorMessage: err?.message || String(err),
      },
    });
    await safeUnlink(inputPath);
  } finally {
    for (const p of chunksToCleanup) {
      await safeUnlink(p);
    }
  }
}

export async function GET() {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const list = await prisma.transcription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      status: true,
      language: true,
      matchMode: true,
      createdAt: true,
      completedAt: true,
      errorMessage: true,
    },
  });

  return NextResponse.json(list);
}
