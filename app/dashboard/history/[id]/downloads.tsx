"use client";

export function HistoryDetailDownloads({
  fileName,
  srt,
  vtt,
  txt,
  raw,
}: {
  fileName: string;
  srt: string | null;
  vtt: string | null;
  txt: string | null;
  raw: string | null;
}) {
  const base = fileName.replace(/\.[^.]+$/, "") || "subtitle";
  const LABEL: Record<string, string> = {
    srt: "_字幕檔",
    vtt: "_網頁字幕",
    txt: "_逐字稿",
    "raw.txt": "_原始辨識",
  };

  function download(content: string, ext: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}${LABEL[ext] ?? ""}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="downloads">
      <button
        className="dl-btn"
        disabled={!srt}
        onClick={() => srt && download(srt, "srt", "text/plain")}
      >
        <span>字幕檔</span>
        <span className="ext">SRT</span>
      </button>
      <button
        className="dl-btn"
        disabled={!vtt}
        onClick={() => vtt && download(vtt, "vtt", "text/vtt")}
      >
        <span>網頁字幕</span>
        <span className="ext">VTT</span>
      </button>
      <button
        className="dl-btn"
        disabled={!txt}
        onClick={() => txt && download(txt, "txt", "text/plain")}
      >
        <span>純文字逐字稿</span>
        <span className="ext">TXT</span>
      </button>
      {raw && (
        <button
          className="dl-btn"
          onClick={() => download(raw, "raw.txt", "text/plain")}
        >
          <span>原始辨識</span>
          <span className="ext">RAW</span>
        </button>
      )}
    </div>
  );
}
