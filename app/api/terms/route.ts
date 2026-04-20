import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const categoryId = req.nextUrl.searchParams.get("categoryId");
  const terms = await prisma.term.findMany({
    where: { ...(categoryId ? { categoryId } : {}) },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(terms);
}

// 支援單一或批量新增
const SingleSchema = z.object({
  text: z.string().min(1).max(50),
  notes: z.string().max(200).optional().nullable(),
  categoryId: z.string().min(1),
});

const BulkSchema = z.object({
  categoryId: z.string().min(1),
  texts: z.array(z.string().min(1).max(50)).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();

  // 批量模式
  if (body.texts && Array.isArray(body.texts)) {
    const parsed = BulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { categoryId, texts } = parsed.data;
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const unique = Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean)));
    // userId 仍寫入：紀錄「誰新增的」
    const created = await prisma.$transaction(
      unique.map((text) =>
        prisma.term.create({ data: { text, categoryId, userId } })
      )
    );
    return NextResponse.json({ count: created.length }, { status: 201 });
  }

  // 單筆
  const parsed = SingleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const cat = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const term = await prisma.term.create({ data: { ...parsed.data, userId } });
  return NextResponse.json(term, { status: 201 });
}
