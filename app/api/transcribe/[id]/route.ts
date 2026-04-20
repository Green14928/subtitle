import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;

  const t = await prisma.transcription.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true, image: true } } },
  });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(t);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;

  const t = await prisma.transcription.findUnique({ where: { id } });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.transcription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
