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

  const hasReplicate = !!process.env.REPLICATE_API_TOKEN;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">辨識字幕</h1>
        <p className="text-slate-600 mt-1">
          上傳影片或音訊 → 選擇詞庫 → 自動產生字幕檔
        </p>
      </div>

      {!hasReplicate && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 text-sm">
          <div className="font-bold mb-1">⚠️ Demo 模式</div>
          <p>
            目前還沒設定 <code className="bg-amber-100 px-1 rounded">REPLICATE_API_TOKEN</code>
            ，所以辨識會回傳示範用的假字幕。
            等你去 <a href="https://replicate.com/account/api-tokens" className="underline font-medium" target="_blank">Replicate</a> 拿 API key 後，
            加到 <code className="bg-amber-100 px-1 rounded">.env.local</code> 重啟即可真正辨識。
          </p>
        </div>
      )}

      <TranscribeClient categories={categories} />
    </div>
  );
}
