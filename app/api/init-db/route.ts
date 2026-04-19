import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 一次性：對 postgres 跑 prisma db push 建表
// 用 AUTH_SECRET 當 bearer，避免被亂用
export async function POST(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;

  if (!secret || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { stdout, stderr } = await execAsync(
      "node node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate",
      { cwd: process.cwd(), env: process.env, timeout: 60_000 }
    );
    return NextResponse.json({ ok: true, stdout, stderr });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err), stderr: err?.stderr, stdout: err?.stdout },
      { status: 500 }
    );
  }
}
