// 用 word-level timestamps 重新組字幕
// Whisper 原生的 segment 一段常常 6-10 秒，時間對不太上；
// 我們改用「字/詞」的時間戳，遇到標點或停頓才斷句，時間軸貼到約 0.1 秒
//
// 若整段都沒標點（常見於連貫口語），會退回「找最大停頓點」機制，
// 避免硬切在詞彙中間（例如把「探討」切成「探」「討」）
import type { Segment } from "./srt";
import type { Word } from "./openai-transcribe";

// 句尾標點：中英混合
const SENT_END = /[。！？.!?…]$/;
// 軟斷點：逗號、分號、頓號等
const SOFT_BREAK = /[，,；;、:：]$/;

// 語尾助詞／連接字：斷句時優先避開「剛好切在這些字後面」
// 因為這類字後面通常句子還沒講完
const TRAILING_PARTICLE = /^[的了著過地得就也還並而或才又且也得嗎呢吧啊呀喔哦耶]$/;

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
  if (!words || words.length === 0) return fallback;

  const maxSec = opts.maxSec ?? 7;
  const minSec = opts.minSec ?? 1.0;
  const pauseSec = opts.pauseSec ?? 0.25;
  const maxChars = opts.maxChars ?? 22;

  const out: Segment[] = [];
  let buf: Word[] = [];
  let bufStart = words[0].start;

  const resetBufStart = () => {
    if (buf.length > 0) bufStart = buf[0].start;
  };

  const flush = () => {
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
  };

  // 從 buf 往回找最佳斷點
  // 回傳切點 index（buf[0..idx) 會 flush，buf[idx..] 留到下一句）
  // 找不到合理斷點就回傳 buf.length（等於就在目前位置切）
  const findBestBreakIdx = (): number => {
    if (buf.length <= 2) return buf.length;
    // 搜尋窗：從中間點起算，至少留 3 個字當新句開頭
    const minIdx = Math.max(3, Math.floor(buf.length * 0.4));

    // 1. 往回找句尾標點
    for (let i = buf.length - 1; i >= minIdx; i--) {
      if (SENT_END.test(buf[i].word)) return i + 1;
    }
    // 2. 往回找軟斷點
    for (let i = buf.length - 1; i >= minIdx; i--) {
      if (SOFT_BREAK.test(buf[i].word)) return i + 1;
    }
    // 3. 往回找最大停頓（至少 0.08 秒才算候選）
    let bestScore = 0.08;
    let bestIdx = -1;
    for (let i = minIdx; i < buf.length; i++) {
      const gap = buf[i].start - buf[i - 1].end;
      const prev = (buf[i - 1].word || "").trim();
      // 若前一個字是語尾助詞／連接字，這邊切下去容易很怪，扣分
      const penalty = TRAILING_PARTICLE.test(prev) ? 0.12 : 0;
      const score = gap - penalty;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx > 0) return bestIdx;

    // 4. 找不到，就退到 70% 位置硬切（至少別把最後幾個字孤立）
    return Math.max(minIdx, Math.floor(buf.length * 0.7));
  };

  const flushWithLookback = () => {
    if (buf.length === 0) return;
    const idx = findBestBreakIdx();
    if (idx >= buf.length) {
      flush();
      return;
    }
    const kept = buf.slice(idx);
    buf = buf.slice(0, idx);
    flush();
    buf = kept;
    resetBufStart();
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (buf.length === 0) bufStart = w.start;
    buf.push(w);

    const curText = buf.map((x) => x.word).join("").trim();
    const curDur = w.end - bufStart;
    const curChars = curText.replace(/\s+/g, "").length;

    const next = words[i + 1];
    const gap = next ? next.start - w.end : Infinity;

    // 強制斷：太長或太多字 → 往回找自然斷點
    if (curDur >= maxSec || curChars >= maxChars) {
      flushWithLookback();
      continue;
    }

    // 硬斷點：句尾標點 + 已夠長
    if (SENT_END.test(curText) && curDur >= minSec) {
      flush();
      continue;
    }

    // 停頓：連貫口語的微停也算（預設 0.25 秒）
    if (gap >= pauseSec && curDur >= minSec) {
      flush();
      continue;
    }

    // 軟斷點：逗號 + 已經夠長（避免逗號太密切太碎）
    if (SOFT_BREAK.test(curText) && curDur >= Math.max(minSec, 2.0)) {
      flush();
      continue;
    }
  }
  flush();

  return out;
}
