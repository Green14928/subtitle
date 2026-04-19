import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL || null,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    REPLICATE_API_TOKEN: !!process.env.REPLICATE_API_TOKEN,
    ALLOWED_EMAILS: (process.env.ALLOWED_EMAILS || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean).length,
  };

  let db: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch (e) {
    db = "error";
  }

  return NextResponse.json({
    status: "ok",
    env,
    db,
    time: new Date().toISOString(),
  });
}
