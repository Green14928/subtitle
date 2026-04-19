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
  srtContent: string | null;
  vttContent: string | null;
  plainText: string | null;
  errorMessage: string | null;
  promptUsed: string | null;
};

export function TranscribeClient({ categories }: { categories: Category[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [language, setLanguage] = useState("zh");
  const [uploading, setUploading] = useState(false);
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
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("language", language);
      fd.append("categoryIds", JSON.stringify(Array.from(selectedCats)));

      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text();
        let msg = `HTTP ${res.status}`;
        try {
          const data = JSON.parse(text);
          msg = data.error || data.message || text || msg;
        } catch {
          msg = text || msg;
        }
        throw new Error(`上傳失敗 (${res.status})：${msg}`);
      }
      const { id } = await res.json();
      setCurrentId(id);
      toast.success("辨識已啟動，處理中…");
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

      {/* 結果 */}
      {currentId && (
        <section className="border-t pt-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">辨識結果</h2>
          {!result || result.status === "pending" || result.status === "processing" ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span>辨識中，大檔案可能需要幾分鐘…</span>
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
