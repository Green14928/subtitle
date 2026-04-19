import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [categoryCount, termCount, transcriptionCount, recentTranscriptions] =
    await Promise.all([
      prisma.category.count({ where: { userId } }),
      prisma.term.count({ where: { userId } }),
      prisma.transcription.count({ where: { userId } }),
      prisma.transcription.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">首頁</h1>
        <p className="text-slate-600 mt-1">歡迎使用字幕辨識系統</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/dictionary"
          className="bg-white rounded-xl p-6 border border-slate-200 hover:border-violet-300 hover:shadow-md transition"
        >
          <div className="text-3xl mb-2">📚</div>
          <div className="text-2xl font-bold text-slate-900">{categoryCount}</div>
          <div className="text-sm text-slate-600">詞庫分類</div>
        </Link>
        <Link
          href="/dashboard/dictionary"
          className="bg-white rounded-xl p-6 border border-slate-200 hover:border-violet-300 hover:shadow-md transition"
        >
          <div className="text-3xl mb-2">🔤</div>
          <div className="text-2xl font-bold text-slate-900">{termCount}</div>
          <div className="text-sm text-slate-600">詞彙總數</div>
        </Link>
        <Link
          href="/dashboard/history"
          className="bg-white rounded-xl p-6 border border-slate-200 hover:border-violet-300 hover:shadow-md transition"
        >
          <div className="text-3xl mb-2">🎬</div>
          <div className="text-2xl font-bold text-slate-900">{transcriptionCount}</div>
          <div className="text-sm text-slate-600">辨識紀錄</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/transcribe"
          className="bg-gradient-to-br from-violet-500 to-pink-500 text-white rounded-xl p-8 hover:shadow-lg transition"
        >
          <div className="text-4xl mb-3">🚀</div>
          <div className="text-xl font-bold mb-1">開始辨識影片</div>
          <div className="text-sm opacity-90">上傳影片 / 音訊，自動套用詞庫生成字幕</div>
        </Link>
        <Link
          href="/dashboard/dictionary"
          className="bg-white rounded-xl p-8 border border-slate-200 hover:border-violet-300 hover:shadow-md transition"
        >
          <div className="text-4xl mb-3">📖</div>
          <div className="text-xl font-bold text-slate-900 mb-1">管理詞庫</div>
          <div className="text-sm text-slate-600">
            新增身心靈專有名詞，讓辨識更準確
          </div>
        </Link>
      </div>

      {recentTranscriptions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-900 mb-4">最近辨識</h2>
          <ul className="space-y-2">
            {recentTranscriptions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium text-slate-900">{t.fileName}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(t.createdAt).toLocaleString("zh-TW")}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-slate-100", text: "text-slate-700", label: "等待中" },
    processing: { bg: "bg-blue-100", text: "text-blue-700", label: "辨識中" },
    completed: { bg: "bg-green-100", text: "text-green-700", label: "完成" },
    failed: { bg: "bg-red-100", text: "text-red-700", label: "失敗" },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className={`text-xs px-2 py-1 rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
