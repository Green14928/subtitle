import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { transcribe, buildPromptFromTerms } from "@/lib/replicate";
import { segmentsToSRT, segmentsToVTT, segmentsToPlainText } from "@/lib/srt";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

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

  // 隨機 32 字元 hex token 作為 capability URL，無法猜測
  const token = crypto.randomBytes(16).toString("hex");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${token}_${safeName}`;
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

  // 組出 Replicate 可存取的 public URL
  const origin = resolvePublicOrigin(req);
  const publicUrl = `${origin}/api/file/${encodeURIComponent(userId)}/${encodeURIComponent(storedName)}`;

  // 非同步處理：先回 response，背景啟動辨識
  processTranscription(transcription.id, filePath, publicUrl, prompt, language).catch(
    (err) => console.error("Transcription error:", err)
  );

  return NextResponse.json({
    id: transcription.id,
    status: "processing",
    message: "辨識已開始，請稍候",
  });
}

// 算出給 Replicate 用的 public origin
// 優先順序：AUTH_URL > NEXTAUTH_URL > request origin
function resolvePublicOrigin(req: NextRequest): string {
  const envUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "");
  }
  // fallback：從 request header 推
  const host = req.headers.get("host") || "localhost:3002";
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// 背景處理函式
async function processTranscription(
  id: string,
  filePath: string,
  publicUrl: string,
  prompt: string,
  language: string
) {
  try {
    await prisma.transcription.update({
      where: { id },
      data: { status: "processing" },
    });

    // 沒 token 時走 stub（本機還沒設 key 時也能測 UI）
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
      await safeUnlink(filePath);
      return;
    }

    // 公網網址不能是 localhost，否則 Replicate 抓不到
    if (publicUrl.includes("localhost") || publicUrl.includes("127.0.0.1")) {
      throw new Error(
        "本機開發不能直接跑真實辨識：publicUrl 是 localhost，Replicate 抓不到。請部署到 Zeabur 測試，或用 ngrok 開 tunnel。"
      );
    }

    const result = await transcribe({
      audioUrl: publicUrl,
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

    await safeUnlink(filePath);
  } catch (err: any) {
    console.error("[transcribe] failed", err);
    await prisma.transcription.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: err?.message || String(err),
      },
    });
    await safeUnlink(filePath);
  }
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // 檔案已不存在就算了
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
