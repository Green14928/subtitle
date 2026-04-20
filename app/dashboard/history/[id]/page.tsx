import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatBytes } from "@/lib/utils";
import { HistoryDetailDownloads } from "./downloads";

export default async function TranscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await auth();

  const t = await prisma.transcription.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true, image: true } } },
  });
  if (!t) notFound();

  const uploader = t.user?.name || t.user?.email || "未知";
  const charCount = t.plainText
    ? t.plainText.replace(/\s+/g, "").length
    : 0;
  const srtLines = t.srtContent ? parseSrt(t.srtContent) : [];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/dashboard/history"
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--text-muted)",
          }}
        >
          ← 回辨識紀錄
        </Link>
      </div>

      <div className="page-head">
        <h1 style={{ wordBreak: "break-all" }}>{t.fileName}</h1>
        <div className="subtitle">
          {new Date(t.createdAt).toLocaleString("zh-TW")}
          {" · "}
          上傳者：{uploader}
          {" · "}
          {t.status === "completed" && <>完成</>}
          {t.status === "failed" && <span style={{ color: "var(--red)" }}>失敗</span>}
        </div>
      </div>

      {t.status === "failed" && t.errorMessage && (
        <div
          style={{
            background: "var(--red-light)",
            color: "var(--red)",
            padding: 16,
            borderRadius: "var(--radius)",
            marginBottom: 16,
            fontSize: "var(--fs-sm)",
          }}
        >
          <b>錯誤訊息：</b>
          <div style={{ marginTop: 6, fontSize: "var(--fs-xs)" }}>{t.errorMessage}</div>
        </div>
      )}

      <div className="result-wrap">
        <div className="sub-list">
          {srtLines.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "var(--fs-sm)",
              }}
            >
              {t.status === "completed"
                ? "（沒有 SRT 內容）"
                : "辨識尚未完成"}
            </div>
          ) : (
            srtLines.map((s, i) => (
              <div key={i} className="sub-row">
                <div className="t">{s.t}</div>
                <div className="line">{s.line}</div>
              </div>
            ))
          )}
        </div>

        <div className="side-panel">
          <h3>辨識摘要</h3>
          <div className="kv">
            <span className="k">狀態</span>
            <span className="v">
              {t.status === "completed"
                ? "完成"
                : t.status === "failed"
                ? "失敗"
                : t.status === "processing"
                ? "進行中"
                : "等待中"}
            </span>
          </div>
          <div className="kv">
            <span className="k">字數</span>
            <span className="v">{charCount.toLocaleString()}</span>
          </div>
          <div className="kv">
            <span className="k">分段</span>
            <span className="v">{srtLines.length}</span>
          </div>
          {t.fileSize && (
            <div className="kv">
              <span className="k">檔案大小</span>
              <span className="v">{formatBytes(t.fileSize)}</span>
            </div>
          )}
          <div className="kv">
            <span className="k">嚴格度</span>
            <span className="v">
              {t.matchMode === "loose"
                ? "寬鬆"
                : t.matchMode === "strict"
                ? "嚴格"
                : "正常"}
            </span>
          </div>
          <div className="kv">
            <span className="k">語言</span>
            <span className="v">
              {t.language === "zh" ? "繁中" : t.language.toUpperCase()}
            </span>
          </div>
          <div className="kv">
            <span className="k">上傳者</span>
            <span className="v">{uploader}</span>
          </div>

          <div
            className="section-label"
            style={{ marginTop: 18, marginBottom: 10 }}
          >
            DOWNLOAD
          </div>
          <HistoryDetailDownloads
            fileName={t.fileName}
            srt={t.srtContent}
            vtt={t.vttContent}
            txt={t.plainText}
            raw={t.rawText}
          />
        </div>
      </div>
    </div>
  );
}

function parseSrt(srt: string) {
  const blocks = srt.split(/\n\s*\n/).filter(Boolean);
  return blocks
    .map((b) => {
      const lines = b.split("\n").filter(Boolean);
      if (lines.length < 2) return null;
      const timing = lines.find((l) => l.includes("-->"));
      if (!timing) return null;
      const [start] = timing.split("-->").map((s) => s.trim());
      const textLines = lines.filter(
        (l) => !l.includes("-->") && !/^\d+$/.test(l)
      );
      return { t: start.split(",")[0], line: textLines.join(" ") };
    })
    .filter((x): x is { t: string; line: string } => !!x);
}
