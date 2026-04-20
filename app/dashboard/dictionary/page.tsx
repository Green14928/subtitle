import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DictionaryClient } from "./dictionary-client";

export default async function DictionaryPage() {
  await auth();

  const categories = await prisma.category.findMany({
    include: {
      terms: { orderBy: { createdAt: "asc" } },
      _count: { select: { terms: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="page-head">
        <h1>詞庫管理</h1>
        <div className="subtitle">
          新增身心靈專有名詞，讓辨識更準確（全團隊共用）
        </div>
      </div>

      <DictionaryClient initialCategories={categories} />
    </div>
  );
}
