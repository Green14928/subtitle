import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.term.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.term.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
