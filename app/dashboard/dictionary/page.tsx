import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DictionaryClient } from "./dictionary-client";

export default async function DictionaryPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const categories = await prisma.category.findMany({
    where: { userId },
    include: {
      terms: { orderBy: { createdAt: "asc" } },
      _count: { select: { terms: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">詞庫管理</h1>
          <p className="text-slate-600 mt-1">
            把身心靈專有名詞加進詞庫，辨識時會自動套用讓準度更高
          </p>
        </div>
      </div>

      <DictionaryClient initialCategories={categories} />
    </div>
  );
}
