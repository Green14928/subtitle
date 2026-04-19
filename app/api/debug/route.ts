import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 診斷端點：檢查 NextAuth 需要的 table 是否都存在且可讀
export async function GET() {
  const checks: Record<string, any> = {};

  async function try_<T>(name: string, fn: () => Promise<T>) {
    try {
      const v = await fn();
      checks[name] = { ok: true, value: v };
    } catch (e: any) {
      checks[name] = { ok: false, error: e?.message || String(e) };
    }
  }

  await try_("user_count", () => prisma.user.count());
  await try_("account_count", () => prisma.account.count());
  await try_("session_count", () => prisma.session.count());
  await try_("verificationToken_count", () => prisma.verificationToken.count());
  await try_("category_count", () => prisma.category.count());
  await try_("term_count", () => prisma.term.count());
  await try_("transcription_count", () => prisma.transcription.count());
  await try_("users_sample", () =>
    prisma.user.findMany({ take: 3, select: { id: true, email: true, createdAt: true } })
  );

  return NextResponse.json({ checks, time: new Date().toISOString() });
}
