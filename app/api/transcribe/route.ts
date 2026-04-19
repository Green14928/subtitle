import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { transcribe, buildPromptFromTerms } from "@/lib/replicate";
import { segmentsToSRT, segmentsToVTT, segmentsToPlainText } from "@/lib/srt";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 300; // 5 minutes

// 處理影片/音訊上傳並啟動辨識
export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const categoryIdsRaw = formData.get("categoryIds") as string;
  const language = (formData.get("language") as string) || "zh";

  if (!file) {
    return NextResponse.json({ error: "沒有檔案" }, { status: 400 });
  }

  const categoryIds: string[] = categoryIdsRaw ? JSON.parse(categoryIdsRaw) : [];

  // 收集詞庫的所有詞彙 → 組 prompt
  const terms = await prisma.term.findMany({
    where: { userId, categoryId: { in: categoryIds } },
    select: { text: true },
  });
  const prompt = buildPromptFromTerms(terms.map((t) => t.text));

  // 存檔到 ./uploads/{userId}/
  const uploadsDir = path.join(process.cwd(), "uploads", userId);
  await mkdir(uploadsDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const storedName = `${timestamp}_${safeName}`;
  const filePath = path.join(uploadsDir, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // 建立 Transcription 記錄
  const transcription = await prisma.transcription.create({
    data: {
      fileName: file.name,
      fileSize: file.size,
      language,
      status: "pending",
      categoryIds: JSON.stringify(categoryIds),
      promptUsed: prompt,
      userId,
    },
  });

  // 非同步處理：先回 response，背景啟動辨識
  processTranscription(transcription.id, filePath, prompt, language).catch(
    (err) => console.error("Transcription error:", err)
  );

  return NextResponse.json({
    id: transcription.id,
    status: "processing",
    message: "辨識已開始，請稍候",
  });
}

// 背景處理函式
async function processTranscription(
  id: string,
  filePath: string,
  prompt: string,
  language: string
) {
  try {
    await prisma.transcription.update({
      where: { id },
      data: { status: "processing" },
    });

    // 目前是 stub：如果沒有 REPLICATE_API_TOKEN，回假資料
    // 有 token 時會真的呼叫 Replicate
    if (!process.env.REPLICATE_API_TOKEN) {
      console.warn("[stub] REPLICATE_API_TOKEN 未設定，回傳假資料");
      await new Promise((r) => setTimeout(r, 3000));

      const fakeSegments = [
        { start: 0, end: 3, text: "（示範字幕）這是一段測試用的字幕。" },
        { start: 3, end: 7, text: "設定 REPLICATE_API_TOKEN 後就會呼叫真正的 WhisperX。" },
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
      return;
    }

    // 真實呼叫（需要 public URL，本機開發要改架構或用 Vercel Blob）
    // TODO Phase 2: 檔案上傳到 Vercel Blob / R2 / Zeabur Storage 取得 public URL
    throw new Error(
      "尚未實作 public URL 上傳流程。部署到 Zeabur 時需要加 Object Storage。"
    );
  } catch (err: any) {
    await prisma.transcription.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: err?.message || String(err),
      },
    });
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
