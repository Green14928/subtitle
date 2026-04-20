import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatBytes } from "@/lib/utils";

export default async function HistoryPage() {
  // 只要登入即可，不分 user 看所有紀錄
  await auth();

  const list = await prisma.transcription.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { name: true, email: true, image: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">辨識紀錄</h1>
        <p className="text-slate-600 mt-1">最近 50 筆（全團隊共用）</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <p>還沒有辨識紀錄</p>
            <Link
              href="/dashboard/transcribe"
              className="inline-block mt-4 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700"
            >
              開始第一次辨識 →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">檔名</th>
                <th className="text-left px-4 py-3">上傳者</th>
                <th className="text-left px-4 py-3">大小</th>
                <th className="text-left px-4 py-3">狀態</th>
                <th className="text-left px-4 py-3">時間</th>
                <th className="text-right px-4 py-3">動作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-xs">
                    {t.fileName}
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs">
                    <UploaderCell user={t.user} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.fileSize ? formatBytes(t.fileSize) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {new Date(t.createdAt).toLocaleString("zh-TW")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status === "completed" && (
                      <Link
                        href={`/dashboard/history/${t.id}`}
                        className="text-violet-600 hover:underline text-xs"
                      >
                        查看 →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function UploaderCell({
  user,
}: {
  user: { name: string | null; email: string; image: string | null } | null;
}) {
  if (!user) return <span className="text-slate-400">—</span>;
  const label = user.name || user.email;
  return (
    <span className="inline-flex items-center gap-1.5">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt=""
          className="w-5 h-5 rounded-full"
        />
      ) : (
        <span className="w-5 h-5 rounded-full bg-slate-300 inline-flex items-center justify-center text-[10px] text-slate-700">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate max-w-28">{label}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-slate-100", text: "text-slate-700", label: "等待中" },
    processing: { bg: "bg-blue-100", text: "text-blue-700", label: "辨識中" },
    completed: { bg: "bg-green-100", text: "text-green-700", label: "✓ 完成" },
    failed: { bg: "bg-red-100", text: "text-red-700", label: "失敗" },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className={`text-xs px-2 py-1 rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
