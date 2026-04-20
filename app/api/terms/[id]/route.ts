import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { z } from "zod";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.term.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.term.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

const PatchSchema = z.object({
  text: z.string().min(1).max(50).optional(),
  notes: z.string().max(200).optional().nullable(),
  aliases: z.array(z.string().min(1).max(50)).max(50).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.term.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const data: {
    text?: string;
    notes?: string | null;
    aliases?: string | null;
  } = {};
  if (parsed.data.text !== undefined) data.text = parsed.data.text;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.aliases !== undefined) {
    const clean = Array.from(
      new Set(parsed.data.aliases.map((a) => a.trim()).filter(Boolean))
    );
    data.aliases = clean.length > 0 ? JSON.stringify(clean) : null;
  }

  const updated = await prisma.term.update({ where: { id }, data });
  return NextResponse.json(updated);
}
