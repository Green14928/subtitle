import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HistoryClient } from "./history-client";

export default async function HistoryPage() {
  await auth();

  const list = await prisma.transcription.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true, image: true } },
    },
  });

  // 序列化 Date
  const serialized = list.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  }));

  return (
    <div>
      <div className="page-head">
        <h1>辨識紀錄</h1>
        <div className="subtitle">所有上傳過的檔案與辨識結果（全團隊共用）</div>
      </div>

      <HistoryClient list={serialized} />
    </div>
  );
}
