import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

// 公開檔案端點：讓 Replicate 能拉使用者上傳的影片/音訊。
// 安全模型：檔名中的 32 字元隨機 token 本身即是 capability URL。
// 沒有 token 沒辦法猜到路徑，辨識完成即刻刪檔。
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "缺少路徑" }, { status: 400 });
  }

  // 防穿越：segments 不能含 ..、/、\
  for (const seg of segments) {
    if (seg.includes("..") || seg.includes("/") || seg.includes("\\")) {
      return NextResponse.json({ error: "非法路徑" }, { status: 400 });
    }
  }

  // 要求檔名至少含 32 字元 hex token（防止瞎猜）
  const filename = segments[segments.length - 1];
  if (!/[a-f0-9]{32}/.test(filename)) {
    return NextResponse.json({ error: "非法檔名" }, { status: 400 });
  }

  const uploadsRoot = path.join(process.cwd(), "uploads");
  const fullPath = path.join(uploadsRoot, ...segments);

  // 再次確認 resolve 出來的路徑在 uploads 內
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(uploadsRoot))) {
    return NextResponse.json({ error: "非法路徑" }, { status: 400 });
  }

  try {
    await stat(resolved);
  } catch {
    return NextResponse.json({ error: "檔案不存在" }, { status: 404 });
  }

  const buffer = await readFile(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const contentType =
    ext === ".mp3"
      ? "audio/mpeg"
      : ext === ".wav"
      ? "audio/wav"
      : ext === ".m4a"
      ? "audio/mp4"
      : ext === ".mp4"
      ? "video/mp4"
      : ext === ".mov"
      ? "video/quicktime"
      : ext === ".webm"
      ? "video/webm"
      : "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
