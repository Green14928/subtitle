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
        status: "pending",
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
  try {
    await prisma.transcription.update({
      where: { id },
      data: { status: "processing" },
    });

    // 沒 key 時走 stub
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[stub] OPENAI_API_KEY 未設定，回傳假資料");
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
          srtContent: segmentsToSRT(fakeSegments),
          vttContent: segmentsToVTT(fakeSegments),
          plainText: segmentsToPlainText(fakeSegments),
          completedAt: new Date(),
        },
      });
      await safeUnlink(inputPath);
      return;
    }

    // 抽音訊 + 必要時切 chunks
    const chunks = await prepareAudioForTranscribe(inputPath, workDir, token);
    chunksToCleanup.push(...chunks.map((c) => c.path));

    // 原始影片不再需要，刪掉省硬碟
    await safeUnlink(inputPath);

    const result = await transcribeChunks({
      chunks,
      initialPrompt: prompt || undefined,
      language,
    });

    await prisma.transcription.update({
      where: { id },
      data: {
        status: "completed",
        srtContent: segmentsToSRT(result.segments),
        vttContent: segmentsToVTT(result.segments),
        plainText: segmentsToPlainText(result.segments),
        completedAt: new Date(),
      },
    });
  } catch (err: any) {
    console.error("[transcribe] failed", err);
    await prisma.transcription.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: err?.message || String(err),
      },
    });
    await safeUnlink(inputPath);
  } finally {
    // 無論成敗都清 chunks
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
