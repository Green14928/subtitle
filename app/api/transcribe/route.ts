import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { transcribeChunks, buildPromptFromTerms } from "@/lib/openai-transcribe";
import { prepareAudioForTranscribe, safeUnlink } from "@/lib/audio";
import { segmentsToSRT, segmentsToVTT, segmentsToPlainText } from "@/lib/srt";
import { mkdir, stat } from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import path from "path";
import crypto from "crypto";

export const maxDuration = 300; // 5 minutes
export const runtime = "nodejs";

// 上傳大檔用 raw body + header metadata，串流寫入硬碟避免 OOM
// Client 以 fetch("POST", body: file) 直送，metadata 走 header
export async function POST(req: NextRequest) {
  try {
    const { error, userId } = await requireAuth();
    if (error) return error;

    const fileNameRaw = req.headers.get("x-file-name");
    const categoryIdsRaw = req.headers.get("x-category-ids") || "[]";
    const language = req.headers.get("x-language") || "zh";

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

    // 收集詞庫的所有詞彙 → 組 prompt
    const terms = await prisma.term.findMany({
      where: { userId, categoryId: { in: categoryIds } },
      select: { text: true },
    });
    const prompt = buildPromptFromTerms(terms.map((t) => t.text));

    // 存檔到 ./uploads/{userId}/
    const uploadsDir = path.join(process.cwd(), "uploads", userId);
    await mkdir(uploadsDir, { recursive: true });

    const token = crypto.randomBytes(16).toString("hex");
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${token}_${safeName}`;
    const filePath = path.join(uploadsDir, storedName);

    // 串流：Web ReadableStream → Node Readable → writeStream
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
        promptUsed: prompt,
        userId,
      },
    });

    // 非同步跑辨識
    processTranscription(transcription.id, filePath, uploadsDir, token, prompt, language).catch(
      (err) => console.error("Transcription error:", err)
    );

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
  language: string
) {
  const chunksToCleanup: string[] = [];

  async function setStage(progress: number, stage: string) {
    await prisma.transcription.update({
      where: { id },
      data: { progress, stage },
    });
  }

  try {
    // 沒 key 時走 stub
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[stub] OPENAI_API_KEY 未設定，回傳假資料");
      await setStage(60, "Demo 模式（無 API key）");
      await new Promise((r) => setTimeout(r, 2000));
      const fakeSegments = [
        { start: 0, end: 3, text: "（示範字幕）這是一段測試用的字幕。" },
        { start: 3, end: 7, text: "設定 OPENAI_API_KEY 後就會呼叫真正的 Whisper。" },
        { start: 7, end: 10, text: "詞庫 prompt: " + prompt.slice(0, 100) },
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
      totalChunks > 1
        ? `準備辨識（音訊切成 ${totalChunks} 段）`
        : "準備辨識"
    );

    // 逐 chunk 辨識以便回報進度
    const { transcribeOneChunk, mergeSegments } = await import("@/lib/openai-transcribe");
    const allSegments: { start: number; end: number; text: string }[] = [];
    let detectedLanguage = language;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const base = 40;
      const span = 55; // 40→95 分配給辨識
      const before = base + Math.floor((span * i) / totalChunks);
      await setStage(before, totalChunks > 1 ? `辨識中 (${i + 1}/${totalChunks})` : "辨識中");

      const res = await transcribeOneChunk(chunk, {
        initialPrompt: prompt || undefined,
        language,
      });
      if (res.language) detectedLanguage = res.language;
      allSegments.push(...res.segments);
    }

    const merged = mergeSegments(allSegments);

    await prisma.transcription.update({
      where: { id },
      data: {
        status: "completed",
        progress: 100,
        stage: "完成",
        srtContent: segmentsToSRT(merged),
        vttContent: segmentsToVTT(merged),
        plainText: segmentsToPlainText(merged),
        completedAt: new Date(),
      },
    });

    // 辨識用完的 detectedLanguage 暫時沒地方存（可忽略）
    void detectedLanguage;
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

// 列出目前使用者的所有辨識紀錄
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
      createdAt: true,
      completedAt: true,
      errorMessage: true,
    },
  });

  return NextResponse.json(list);
}
