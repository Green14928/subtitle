"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  _count: { terms: number };
};

type Transcription = {
  id: string;
  fileName: string;
  status: string;
  progress: number;
  stage: string | null;
  srtContent: string | null;
  vttContent: string | null;
  plainText: string | null;
  rawText?: string | null;
  errorMessage: string | null;
  promptUsed: string | null;
  matchMode?: string | null;
};

type MatchMode = "loose" | "normal" | "strict";

const STEPS = ["上傳", "抽音訊", "辨識", "套用詞庫"];

function stageToStep(progress: number) {
  if (progress < 25) return 0;
  if (progress < 40) return 1;
  if (progress < 85) return 2;
  return 3;
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
      const textLines = lines.filter((l) => !l.includes("-->") && !/^\d+$/.test(l));
      return { t: start.split(",")[0], line: textLines.join(" ") };
    })
    .filter((x): x is { t: string; line: string } => !!x);
}

export function TranscribeClient({ categories }: { categories: Category[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "processing" | "done" | "failed">(
    "idle"
  );
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id))
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [language, setLanguage] = useState("zh");
  const [matchMode, setMatchMode] = useState<MatchMode>("normal");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [result, setResult] = useState<Transcription | null>(null);
  const [activeLine, setActiveLine] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // Poll 辨識狀態
  useEffect(() => {
    if (!currentId) return;
    if (result?.status === "completed" || result?.status === "failed") return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcribe/${currentId}`);
        if (!res.ok) return;
        const data = await res.json();
        setResult(data);
        if (data.status === "completed") {
          setPhase("done");
          clearInterval(timer);
        } else if (data.status === "failed") {
          setPhase("failed");
          clearInterval(timer);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, [currentId, result?.status]);

  const onPick = () => fileInput.current?.click();
  const onFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
  };

  async function startTranscribe() {
    if (!file) return;
    setPhase("processing");
    setResult(null);
    setUploadProgress(0);
    try {
      const { id } = await uploadWithProgress(file, {
        categoryIds: Array.from(selectedCats),
        language,
        matchMode,
        onProgress: setUploadProgress,
      });
      setCurrentId(id);
    } catch (e: any) {
      toast.error(e.message || "上傳失敗");
      setPhase("idle");
    }
  }

  function reset() {
    setFile(null);
    setPhase("idle");
    setUploadProgress(0);
    setCurrentId(null);
    setResult(null);
    setActiveLine(0);
    if (fileInput.current) fileInput.current.value = "";
  }

  function download(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalTerms = useMemo(
    () =>
      categories
        .filter((c) => selectedCats.has(c.id))
        .reduce((s, c) => s + c._count.terms, 0),
    [categories, selectedCats]
  );

  const parsedLines = useMemo(
    () => (result?.srtContent ? parseSrt(result.srtContent) : []),
    [result?.srtContent]
  );

  const progressVal = result?.progress ?? uploadProgress;
  const currentStep = phase === "processing" ? stageToStep(progressVal) : 4;

  // ─── Phase: idle ─────────────────────────────
  if (phase === "idle") {
    return (
      <>
        <div
          className="upload-zone"
          onClick={onPick}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("drag");
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove("drag")}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("drag");
            onFile(e.dataTransfer.files?.[0] ?? null);
          }}
          style={file ? { borderStyle: "solid", borderColor: "var(--product)" } : {}}
        >
          <input
            ref={fileInput}
            type="file"
            accept="video/*,audio/*"
            style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <div className="up-icon">✓</div>
              <div className="up-title">{file.name}</div>
              <div className="up-desc">
                {formatBytes(file.size)} · {file.type || "unknown"}
              </div>
              <div className="up-formats">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                  }}
                >
                  重選
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="up-icon">↑</div>
              <div className="up-title">點擊或拖曳檔案到此處</div>
              <div className="up-desc">支援影片與音訊格式</div>
              <div className="up-formats">
                {["MP4", "MOV", "M4A", "WAV", "MP3", "AAC"].map((f) => (
                  <span key={f} className="fmt-chip">
                    {f}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="section-head">
          <div>
            <div className="lbl">OPTIONS</div>
            <div className="ttl" style={{ marginTop: 4 }}>
              辨識選項
            </div>
          </div>
          <div className="hint">下列設定影響辨識準度</div>
        </div>

        <div className="proc-card">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              marginBottom: 24,
            }}
          >
            <OptBlock label="語言">
              <select
                className="input"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="zh">繁體中文（台灣）</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
              </select>
            </OptBlock>
            <OptBlock
              label="套用詞庫"
              hint={
                categories.length === 0
                  ? "還沒有詞庫"
                  : `${selectedCats.size}/${categories.length} 個分類 · ${totalTerms} 個字詞`
              }
            >
              {categories.length === 0 ? (
                <a
                  href="/dashboard/dictionary"
                  style={{
                    color: "var(--product)",
                    fontSize: "var(--fs-sm)",
                    textDecoration: "underline",
                  }}
                >
                  去建立詞庫 →
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen ? "收起" : "選擇分類"}
                </button>
              )}
            </OptBlock>
          </div>

          {advancedOpen && categories.length > 0 && (
            <div
              style={{
                padding: 16,
                background: "var(--bg)",
                borderRadius: "var(--radius)",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: "var(--fs-xs)",
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCats(new Set(categories.map((c) => c.id)))}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--product)",
                    cursor: "pointer",
                  }}
                >
                  全選
                </button>
                <span style={{ color: "var(--border)" }}>|</span>
                <button
                  type="button"
                  onClick={() => setSelectedCats(new Set())}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  全不選
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {categories.map((cat) => {
                  const on = selectedCats.has(cat.id);
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => {
                        setSelectedCats((prev) => {
                          const next = new Set(prev);
                          if (next.has(cat.id)) next.delete(cat.id);
                          else next.add(cat.id);
                          return next;
                        });
                      }}
                      className={on ? "filter-pill active" : "filter-pill"}
                    >
                      {cat.name} · {cat._count.terms}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 2,
                color: "var(--text-muted)",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              詞庫比對嚴格度
            </div>
            <p
              style={{
                fontSize: "var(--fs-xs)",
                color: "var(--text-muted)",
                marginBottom: 10,
                fontWeight: 400,
              }}
            >
              決定辨識完後，要不要把錯字換成詞庫裡的正確寫法
            </p>
            <div className="mode-grid">
              <ModeCard
                active={matchMode === "loose"}
                onClick={() => setMatchMode("loose")}
                emoji="🟢"
                title="寬鬆"
                desc="只提示 Whisper，不做後處理"
                cost="免費"
              />
              <ModeCard
                active={matchMode === "normal"}
                onClick={() => setMatchMode("normal")}
                emoji="🟡"
                title="正常（預設）"
                desc="替換詞庫的「常見錯字」清單"
                cost="免費"
              />
              <ModeCard
                active={matchMode === "strict"}
                onClick={() => setMatchMode("strict")}
                emoji="🔴"
                title="嚴格"
                desc="整篇丟 GPT-4 看完整詞庫重校"
                cost="+ $0.5 / 小時"
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              className="btn btn-primary"
              onClick={startTranscribe}
              disabled={!file}
            >
              開始辨識 →
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── Phase: processing / failed ──────────────
  if (phase === "processing" || phase === "failed") {
    return (
      <div className="proc-card">
        <div className="proc-file">
          <div className="thumb">{guessExt(file?.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="fname">{file?.name}</div>
            <div className="fmeta">
              {file && <span>{formatBytes(file.size)}</span>}
              <span>繁體中文</span>
              <span>
                嚴格度：
                {matchMode === "loose" ? "寬鬆" : matchMode === "strict" ? "嚴格" : "正常"}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={reset}>
            取消
          </button>
        </div>

        <div className="proc-steps">
          {STEPS.map((label, i) => (
            <div
              key={i}
              className={`proc-step ${
                i < currentStep ? "done" : i === currentStep ? "active" : ""
              }`}
            >
              <div className="dot">{i < currentStep ? "✓" : i + 1}</div>
              <div className="lbl">{label}</div>
            </div>
          ))}
        </div>

        <div className="proc-progress">
          <div className="fill" style={{ width: `${progressVal}%` }} />
        </div>
        <div className="proc-pct-row">
          <span>{result?.stage || (progressVal < 25 ? "上傳中" : "處理中")}</span>
          <span className="pct">{Math.round(progressVal)}%</span>
        </div>

        {phase === "failed" && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "var(--red-light)",
              color: "var(--red)",
              borderRadius: "var(--radius)",
              fontSize: "var(--fs-sm)",
            }}
          >
            <b>辨識失敗</b>
            <div style={{ fontSize: "var(--fs-xs)", marginTop: 4 }}>
              {result?.errorMessage}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Phase: done ─────────────────────────────
  const hitCount = countHits(result?.plainText ?? "", categories);
  const charCount = result?.plainText?.replace(/\s+/g, "").length ?? 0;

  return (
    <div>
      <div className="proc-card" style={{ marginBottom: 16 }}>
        <div
          className="proc-file"
          style={{ paddingBottom: 0, marginBottom: 0, borderBottom: "none" }}
        >
          <div className="thumb">{guessExt(file?.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="fname">{file?.name}</div>
            <div className="fmeta">
              {file && <span>{formatBytes(file.size)}</span>}
              <span>{charCount.toLocaleString()} 字</span>
              <span>{parsedLines.length} 段</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={reset}>
              辨識新檔案
            </button>
            <a
              className="btn btn-primary"
              href={`/dashboard/history/${currentId}`}
            >
              查看紀錄
            </a>
          </div>
        </div>
      </div>

      <div className="result-wrap">
        <div className="sub-list">
          {parsedLines.map((s, i) => (
            <div
              key={i}
              className={`sub-row ${i === activeLine ? "active" : ""}`}
              onClick={() => setActiveLine(i)}
            >
              <div className="t">{s.t}</div>
              <div className="line">{highlightTerms(s.line, categories)}</div>
            </div>
          ))}
          {parsedLines.length === 0 && (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "var(--fs-sm)",
              }}
            >
              （未產生 SRT）
            </div>
          )}
        </div>

        <div className="side-panel">
          <h3>辨識摘要</h3>
          <div className="kv">
            <span className="k">字數</span>
            <span className="v">{charCount.toLocaleString()}</span>
          </div>
          <div className="kv">
            <span className="k">分段</span>
            <span className="v">{parsedLines.length}</span>
          </div>
          <div className="kv">
            <span className="k">詞庫命中</span>
            <span className="v">{hitCount} 處</span>
          </div>
          <div className="kv">
            <span className="k">嚴格度</span>
            <span className="v">
              {matchMode === "loose"
                ? "寬鬆"
                : matchMode === "strict"
                ? "嚴格"
                : "正常"}
            </span>
          </div>
          <div className="kv">
            <span className="k">語言</span>
            <span className="v">
              {language === "zh" ? "繁中" : language.toUpperCase()}
            </span>
          </div>

          <div className="section-label" style={{ marginTop: 18, marginBottom: 10 }}>
            DOWNLOAD
          </div>
          <div className="downloads">
            <button
              className="dl-btn"
              disabled={!result?.srtContent}
              onClick={() =>
                result?.srtContent &&
                download(
                  result.srtContent,
                  (file?.name || "subtitle").replace(/\.[^.]+$/, "") + ".srt",
                  "text/plain"
                )
              }
            >
              <span>字幕檔</span>
              <span className="ext">SRT</span>
            </button>
            <button
              className="dl-btn"
              disabled={!result?.vttContent}
              onClick={() =>
                result?.vttContent &&
                download(
                  result.vttContent,
                  (file?.name || "subtitle").replace(/\.[^.]+$/, "") + ".vtt",
                  "text/vtt"
                )
              }
            >
              <span>網頁字幕</span>
              <span className="ext">VTT</span>
            </button>
            <button
              className="dl-btn"
              disabled={!result?.plainText}
              onClick={() =>
                result?.plainText &&
                download(
                  result.plainText,
                  (file?.name || "subtitle").replace(/\.[^.]+$/, "") + ".txt",
                  "text/plain"
                )
              }
            >
              <span>純文字逐字稿</span>
              <span className="ext">TXT</span>
            </button>
            {result?.rawText && (
              <button
                className="dl-btn"
                onClick={() =>
                  download(
                    result.rawText!,
                    (file?.name || "subtitle").replace(/\.[^.]+$/, "") +
                      ".raw.txt",
                    "text/plain"
                  )
                }
              >
                <span>原始辨識</span>
                <span className="ext">RAW</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: "var(--text-muted)",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ marginBottom: 6 }}>{children}</div>
      {hint && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontWeight: 400 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  emoji,
  title,
  desc,
  cost,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  desc: string;
  cost: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "mode-card active" : "mode-card"}
    >
      <div className="mc-title">
        <span>{emoji}</span>
        <span>{title}</span>
      </div>
      <div className="mc-desc">{desc}</div>
      <div className="mc-cost">{cost}</div>
    </button>
  );
}

function guessExt(name?: string) {
  if (!name) return "FILE";
  return (name.split(".").pop() || "FILE").toUpperCase().slice(0, 4);
}

function countHits(text: string, categories: Category[]): number {
  void categories;
  if (!text) return 0;
  // 粗估：詞庫命中字幕會帶有 hl 標記，但這裡是純文字，沒辦法精準。先回 0 避免誤導。
  return 0;
}

function highlightTerms(line: string, _categories: Category[]) {
  void _categories;
  // 未來可以從 server 帶 hits 下來高亮，暫時純文字
  return line;
}

function uploadWithProgress(
  file: File,
  opts: {
    categoryIds: string[];
    language: string;
    matchMode: string;
    onProgress: (pct: number) => void;
  }
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/transcribe", true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.setRequestHeader("X-Language", opts.language);
    xhr.setRequestHeader("X-Category-Ids", JSON.stringify(opts.categoryIds));
    xhr.setRequestHeader("X-Match-Mode", opts.matchMode);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("上傳成功但回應格式異常"));
        }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const data = JSON.parse(xhr.responseText);
          msg = data.error || data.message || xhr.responseText || msg;
        } catch {}
        reject(new Error(`上傳失敗 (${xhr.status})：${msg}`));
      }
    };
    xhr.onerror = () => reject(new Error("網路錯誤"));
    xhr.ontimeout = () => reject(new Error("上傳超時"));
    xhr.send(file);
  });
}
