// 用 word-level timestamps 重新組字幕
// Whisper 原生的 segment 一段常常 6-10 秒，時間對不太上；
// 我們改用「字/詞」的時間戳，遇到標點或停頓才斷句，時間軸貼到約 0.1 秒
import type { Segment } from "./srt";
import type { Word } from "./openai-transcribe";

// 句尾標點：中英混合
const SENT_END = /[。！？.!?…]$/;
// 軟斷點：逗號、分號、頓號等
const SOFT_BREAK = /[，,；;、:：]$/;

type Options = {
  maxSec?: number;    // 每句最長秒數（超過強制斷）
  minSec?: number;    // 每句最短秒數（避免兩字一句）
  pauseSec?: number;  // 停頓多久算斷句
  maxChars?: number;  // 每句最多字數（中文字幕可讀性）
};

export function buildSegmentsFromWords(
  words: Word[],
  fallback: Segment[] = [],
  opts: Options = {}
): Segment[] {
  // Whisper 有時候 word-level 拿不到（或為空），退回 segment-level
  if (!words || words.length === 0) return fallback;

  const maxSec = opts.maxSec ?? 8;
  const minSec = opts.minSec ?? 1.2;
  const pauseSec = opts.pauseSec ?? 0.6;
  const maxChars = opts.maxChars ?? 28;

  const out: Segment[] = [];
  let buf: Word[] = [];
  let bufStart = words[0].start;

  const flush = (forceSoft = false) => {
    if (buf.length === 0) return;
    const text = buf.map((w) => w.word).join("").trim();
    if (!text) {
      buf = [];
      return;
    }
    const start = bufStart;
    const end = buf[buf.length - 1].end;
    out.push({ start, end, text });
    buf = [];
    void forceSoft;
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (buf.length === 0) bufStart = w.start;
    buf.push(w);

    const curText = buf.map((x) => x.word).join("").trim();
    const curDur = w.end - bufStart;
    const curChars = curText.replace(/\s+/g, "").length;

    // 判斷下一個 word 的停頓
    const next = words[i + 1];
    const gap = next ? next.start - w.end : Infinity;

    // 強制斷：太長或太多字
    if (curDur >= maxSec || curChars >= maxChars) {
      flush();
      continue;
    }

    // 硬斷點：句尾標點 + 已夠長
    if (SENT_END.test(curText) && curDur >= minSec) {
      flush();
      continue;
    }

    // 大停頓：明顯停下來了
    if (gap >= pauseSec && curDur >= minSec) {
      flush();
      continue;
    }

    // 軟斷點：逗號 + 已經夠長
    if (SOFT_BREAK.test(curText) && curDur >= Math.max(minSec, 2.5)) {
      flush();
      continue;
    }
  }
  flush();

  return out;
}
