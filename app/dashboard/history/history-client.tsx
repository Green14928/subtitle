"use client";
import { useState } from "react";
import Link from "next/link";
import { formatBytes } from "@/lib/utils";

const PATTERNS = ["pat-a", "pat-b", "pat-c", "pat-d"];

type Row = {
  id: string;
  fileName: string;
  fileSize: number | null;
  status: string;
  progress: number;
  matchMode: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  plainText: string | null;
  user: { name: string | null; email: string; image: string | null } | null;
};

export function HistoryClient({ list }: { list: Row[] }) {
  const [filter, setFilter] = useState<"all" | "done" | "fail" | "run">("all");

  const done = list.filter((h) => h.status === "completed").length;
  const fail = list.filter((h) => h.status === "failed").length;
  const run = list.filter(
    (h) => h.status === "processing" || h.status === "pending"
  ).length;

  const filtered = list.filter((h) =>
    filter === "all"
      ? true
      : filter === "done"
      ? h.status === "completed"
      : filter === "fail"
      ? h.status === "failed"
      : h.status === "processing" || h.status === "pending"
  );

  return (
    <>
      <div className="hist-filters">
        <button
          className={`filter-pill ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          全部 · {list.length}
        </button>
        <button
          className={`filter-pill ${filter === "done" ? "active" : ""}`}
          onClick={() => setFilter("done")}
        >
          完成 · {done}
        </button>
        <button
          className={`filter-pill ${filter === "run" ? "active" : ""}`}
          onClick={() => setFilter("run")}
        >
          進行中 · {run}
        </button>
        <button
          className={`filter-pill ${filter === "fail" ? "active" : ""}`}
          onClick={() => setFilter("fail")}
        >
          失敗 · {fail}
        </button>
      </div>

      <div className="hist-table">
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "var(--text-muted)",
              fontWeight: 400,
            }}
          >
            目前沒有符合條件的紀錄
          </div>
        ) : (
          filtered.map((t, idx) => {
            const pattern = PATTERNS[idx % PATTERNS.length];
            const uploader = t.user?.name || t.user?.email || "—";
            const charCount = t.plainText
              ? t.plainText.replace(/\s+/g, "").length
              : 0;
            const href =
              t.status === "completed"
                ? `/dashboard/history/${t.id}`
                : `/dashboard/history`;

            return (
              <Link href={href} key={t.id} className="rec-row">
                <div className={`rec-thumb ${pattern}`}>
                  {guessExt(t.fileName)}
                </div>
                <div className="rec-info">
                  <div className="name">{t.fileName}</div>
                  <div className="meta">
                    <span>{new Date(t.createdAt).toLocaleString("zh-TW")}</span>
                    {t.fileSize && <span>{formatBytes(t.fileSize)}</span>}
                    {t.status === "completed" && charCount > 0 && (
                      <span>{charCount.toLocaleString()} 字</span>
                    )}
                    <span>上傳者：{uploader}</span>
                  </div>
                </div>
                <div className="rec-progress">
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{ width: `${t.progress ?? 0}%` }}
                    />
                  </div>
                  <div className="pct">{t.progress ?? 0}%</div>
                </div>
                <div>
                  {t.status === "completed" && (
                    <span className="status-tag done">
                      <span className="dot" />
                      完成
                    </span>
                  )}
                  {t.status === "failed" && (
                    <span className="status-tag fail">
                      <span className="dot" />
                      失敗
                    </span>
                  )}
                  {(t.status === "processing" || t.status === "pending") && (
                    <span className="status-tag run">
                      <span className="dot" />
                      進行中
                    </span>
                  )}
                </div>
                <div className="rec-actions">
                  <span className="icon-btn" title="查看">
                    →
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}

function guessExt(name: string) {
  return (name.split(".").pop() || "FILE").toUpperCase().slice(0, 4);
}
