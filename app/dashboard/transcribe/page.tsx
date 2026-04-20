import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TranscribeClient } from "./transcribe-client";

export default async function TranscribePage() {
  await auth();

  const categories = await prisma.category.findMany({
    include: { _count: { select: { terms: true } } },
    orderBy: { createdAt: "asc" },
  });

  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  return (
    <div>
      <div className="page-head">
        <h1>辨識字幕</h1>
        <div className="subtitle">
          上傳影片或音訊檔，系統會自動生成字幕並套用詞庫
        </div>
      </div>

      {!hasOpenAI && (
        <div
          style={{
            background: "var(--red-light)",
            color: "var(--red)",
            border: "1px solid var(--red)",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            fontSize: "var(--fs-sm)",
            marginBottom: 16,
          }}
        >
          ⚠️ 尚未設定 OPENAI_API_KEY，目前只會回 Demo 字幕。
        </div>
      )}

      <TranscribeClient categories={categories} />
    </div>
  );
}
