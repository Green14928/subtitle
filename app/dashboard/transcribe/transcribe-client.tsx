"use client";
import { useState, useRef, useEffect } from "react";
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
  errorMessage: string | null;
  promptUsed: string | null;
};

type MatchMode = "loose" | "normal" | "strict";

export function TranscribeClient({ categories }: { categories: Category[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [language, setLanguage] = useState("zh");
  const [matchMode, setMatchMode] = useState<MatchMode>("normal");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [result, setResult] = useState<Transcription | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(timer);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(timer);
  }, [currentId, result?.status]);

  function toggleCategory(id: string) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startTranscribe() {
    if (!file) {
      toast.error("請選擇檔案");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setResult(null);
    try {
      // 用 XHR 以便拿到上傳進度
      const { id } = await uploadWithProgress(file, {
        categoryIds: Array.from(selectedCats),
        language,
        matchMode,
        onProgress: (pct) => setUploadProgress(pct),
      });
      setCurrentId(id);
      toast.success("上傳完成，辨識中…");
    } catch (e: any) {
      toast.error(e.message || "失敗");
    } finally {
      setUploading(false);
    }
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

  function reset() {
    setFile(null);
    setCurrentId(null);
    setResult(null);
    setSelectedCats(new Set());
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = uploading || (currentId && result?.status !== "completed" && result?.status !== "failed");

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      {/* Step 1: 選檔案 */}
      <section>
        <h2 className="text-sm font-bold text-slate-900 mb-2">1. 選擇檔案</h2>
        <label
          htmlFor="file-input"
          className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            file
              ? "border-violet-300 bg-violet-50"
              : "border-slate-300 hover:border-violet-400 hover:bg-slate-50"
          }`}
        >
          <input
            id="file-input"
            ref={inputRef}
            type="file"
            accept="video/*,audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
            disabled={!!busy}
          />
          {file ? (
            <div>
              <div className="text-3xl mb-2">✅</div>
              <div className="font-medium text-slate-900">{file.name}</div>
              <div className="text-xs text-slate-500 mt-1">
                {formatBytes(file.size)} · {file.type || "unknown"}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-2">📁</div>
              <div className="text-slate-700 font-medium">點擊選擇影片或音訊檔</div>
              <div className="text-xs text-slate-500 mt-1">
                支援 mp4, mov, mp3, wav, m4a 等格式
              </div>
            </div>
          )}
        </label>
      </section>

      {/* Step 2: 詞庫 */}
      <section>
        <h2 className="text-sm font-bold text-slate-900 mb-2">
          2. 選擇要套用的詞庫（可多選）
        </h2>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            你還沒建立任何詞庫。
            <a href="/dashboard/dictionary" className="text-violet-600 underline ml-1">
              去建立詞庫 →
            </a>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const selected = selectedCats.has(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  disabled={!!busy}
                  className={`px-4 py-2 rounded-full text-sm border transition ${
                    selected
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-slate-700 border-slate-300 hover:border-violet-400"
                  }`}
                >
                  {cat.name}
                  <span className="ml-2 text-xs opacity-75">
                    {cat._count.terms}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {selectedCats.size > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            已選 {selectedCats.size} 個分類，共
            {" "}
            {categories
              .filter((c) => selectedCats.has(c.id))
              .reduce((s, c) => s + c._count.terms, 0)}
            {" "}
            個詞彙會當作 prompt
          </p>
        )}
      </section>

      {/* Step 3: 語言 */}
      <section>
        <h2 className="text-sm font-bold text-slate-900 mb-2">3. 影片語言</h2>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={!!busy}
          className="border border-slate-300 rounded px-3 py-2 text-sm"
        >
          <option value="zh">中文（繁體 / 簡體）</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
        </select>
      </section>

      {/* Step 4: 詞庫比對嚴格度 */}
      <section>
        <h2 className="text-sm font-bold text-slate-900 mb-2">
          4. 詞庫比對嚴格度
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          控制辨識完後「要不要把錯字換成詞庫裡的正確寫法」。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <MatchModeCard
            active={matchMode === "loose"}
            onClick={() => setMatchMode("loose")}
            disabled={!!busy}
            emoji="🟢"
            label="寬鬆"
            desc="只提示 Whisper，不做後處理。適合主題雜、怕誤傷的影片。"
            cost="免費"
          />
          <MatchModeCard
            active={matchMode === "normal"}
            onClick={() => setMatchMode("normal")}
            disabled={!!busy}
            emoji="🟡"
            label="正常（預設）"
            desc="只替換「常見錯字」清單裡的詞（詞庫要填 aliases 才會生效）。"
            cost="免費"
          />
          <MatchModeCard
            active={matchMode === "strict"}
            onClick={() => setMatchMode("strict")}
            disabled={!!busy}
            emoji="🔴"
            label="嚴格"
            desc="整篇丟 GPT-4 看完整詞庫重校。精準度最高。"
            cost="+ $0.5/小時"
          />
        </div>
      </section>

      {/* 執行 */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={startTranscribe}
          disabled={!file || !!busy}
          className="flex-1 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-medium py-3 rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy ? "辨識中…" : "🚀 開始辨識"}
        </button>
        {(file || result) && (
          <button
            onClick={reset}
            disabled={uploading}
            className="px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            重設
          </button>
        )}
      </div>

      {/* 上傳中：顯示上傳進度條（0-25% 對應 0-100% 上傳完成）*/}
      {uploading && (
        <section className="border-t pt-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">上傳中</h2>
          <ProgressBar percent={uploadProgress} label={`上傳中 ${uploadProgress}%`} />
        </section>
      )}

      {/* 結果 */}
      {currentId && (
        <section className="border-t pt-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">辨識結果</h2>
          {!result || result.status === "pending" || result.status === "processing" ? (
            <div className="space-y-3">
              <ProgressBar
                percent={result?.progress ?? 25}
                label={result?.stage || "準備中"}
              />
              <p className="text-xs text-slate-500">
                整體進度會隨階段更新，大檔案可能需要幾分鐘。
              </p>
            </div>
          ) : result.status === "failed" ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900">
              <div className="font-bold">辨識失敗</div>
              <div className="mt-1 text-xs">{result.errorMessage}</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
                ✅ 辨識完成！
              </div>

              <div className="flex flex-wrap gap-2">
                {result.srtContent && (
                  <button
                    onClick={() =>
                      download(
                        result.srtContent!,
                        result.fileName.replace(/\.[^.]+$/, "") + ".srt",
                        "text/plain"
                      )
                    }
                    className="bg-violet-600 text-white text-sm px-4 py-2 rounded hover:bg-violet-700"
                  >
                    ⬇️ 下載 SRT
                  </button>
                )}
                {result.vttContent && (
                  <button
                    onClick={() =>
                      download(
                        result.vttContent!,
                        result.fileName.replace(/\.[^.]+$/, "") + ".vtt",
                        "text/vtt"
                      )
                    }
                    className="bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded hover:bg-slate-300"
                  >
                    ⬇️ 下載 VTT
                  </button>
                )}
                {result.plainText && (
                  <button
                    onClick={() =>
                      download(
                        result.plainText!,
                        result.fileName.replace(/\.[^.]+$/, "") + ".txt",
                        "text/plain"
                      )
                    }
                    className="bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded hover:bg-slate-300"
                  >
                    ⬇️ 下載 TXT
                  </button>
                )}
              </div>

              {result.plainText && (
                <div>
                  <h3 className="text-xs font-medium text-slate-700 mb-1">
                    逐字稿預覽
                  </h3>
                  <pre className="bg-slate-50 rounded-lg p-3 text-xs whitespace-pre-wrap max-h-60 overflow-auto">
                    {result.plainText}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-700 mb-1">
        <span>{label}</span>
        <span className="font-medium tabular-nums">{p}%</span>
      </div>
      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-300"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function MatchModeCard({
  active,
  onClick,
  disabled,
  emoji,
  label,
  desc,
  cost,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  emoji: string;
  label: string;
  desc: string;
  cost: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-3 rounded-xl border-2 transition ${
        active
          ? "border-violet-500 bg-violet-50"
          : "border-slate-200 hover:border-slate-300 bg-white"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{emoji}</span>
        <span className="font-medium text-sm text-slate-900">{label}</span>
      </div>
      <p className="text-xs text-slate-600 leading-snug">{desc}</p>
      <p className="text-[11px] text-slate-500 mt-1">{cost}</p>
    </button>
  );
}

// 用 XHR 包一層上傳，提供 onProgress
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
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
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
        } catch {
          msg = xhr.responseText || msg;
        }
        reject(new Error(`上傳失敗 (${xhr.status})：${msg}`));
      }
    };

    xhr.onerror = () => reject(new Error("網路錯誤，請檢查連線"));
    xhr.ontimeout = () => reject(new Error("上傳超時"));
    xhr.send(file);
  });
}
