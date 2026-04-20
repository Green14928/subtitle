import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function TranscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await auth();

  const t = await prisma.transcription.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  if (!t) notFound();

  const uploader = t.user?.name || t.user?.email || "未知";

  return (
    <div className="space-y-4">
      <Link href="/dashboard/history" className="text-sm text-slate-600 hover:text-slate-900">
        ← 回辨識紀錄
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t.fileName}</h1>
        <p className="text-slate-600 text-sm mt-1">
          {new Date(t.createdAt).toLocaleString("zh-TW")} · {t.status} · 上傳者：{uploader}
        </p>
      </div>

      {t.promptUsed && (
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-600 mb-1">
            使用的 prompt（詞庫）
          </div>
          <p className="text-sm text-slate-800">{t.promptUsed}</p>
        </div>
      )}

      {t.plainText && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">逐字稿</h2>
          <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans">
            {t.plainText}
          </pre>
        </div>
      )}

      {t.srtContent && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">SRT 字幕</h2>
          <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono bg-slate-50 rounded p-3 max-h-96 overflow-auto">
            {t.srtContent}
          </pre>
        </div>
      )}
    </div>
  );
}
