import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { z } from "zod";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const categories = await prisma.category.findMany({
    include: { _count: { select: { terms: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(categories);
}

const CreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional().nullable(),
  color: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  // userId 仍寫入：紀錄「誰建的」
  const category = await prisma.category.create({
    data: { ...parsed.data, userId },
  });

  return NextResponse.json(category, { status: 201 });
}
