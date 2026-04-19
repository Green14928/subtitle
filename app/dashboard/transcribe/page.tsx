import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TranscribeClient } from "./transcribe-client";

export default async function TranscribePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const categories = await prisma.category.findMany({
    where: { userId },
    include: { _count: { select: { terms: true } } },
    orderBy: { createdAt: "asc" },
  });

  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">辨識字幕</h1>
        <p className="text-slate-600 mt-1">
          上傳影片或音訊 → 選擇詞庫 → 自動產生字幕檔
        </p>
      </div>

      {!hasOpenAI && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 text-sm">
          <div className="font-bold mb-1">⚠️ Demo 模式</div>
          <p>
            目前還沒設定 <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code>
            ，所以辨識會回傳示範用的假字幕。
            到 <a href="https://platform.openai.com/api-keys" className="underline font-medium" target="_blank">OpenAI</a> 拿 API key 後，
            設到伺服器環境變數重啟即可真正辨識。
          </p>
        </div>
      )}

      <TranscribeClient categories={categories} />
    </div>
  );
}
