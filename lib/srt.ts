// SRT / VTT 格式化工具

export type Segment = {
  start: number; // seconds
  end: number;
  text: string;
};

// 修正連續字幕時間重疊 / 邊界相接：若前句 end >= 後句 start，把前句 end 拉回後句 start - 1ms
// 後句時間為主（不動）；Whisper 原生 segment 常常前後句首尾完全對齊，
// 在播放器上看起來像兩句同時顯示一 frame，所以相接也要拉開
const MIN_GAP_SEC = 0.001;
export function clampSegmentOverlaps(segments: Segment[]): Segment[] {
  if (segments.length < 2) return segments;
  const out = segments.map((s) => ({ ...s }));
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].end >= out[i + 1].start) {
      const target = out[i + 1].start - MIN_GAP_SEC;
      // 防極短 cue：若拉回會讓 end <= start，退回成至少 start + MIN_GAP_SEC
      out[i].end = target > out[i].start ? target : out[i].start + MIN_GAP_SEC;
    }
  }
  return out;
}

function formatTimeSRT(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatTimeVTT(sec: number) {
  return formatTimeSRT(sec).replace(",", ".");
}

function pad(n: number, width = 2) {
  return n.toString().padStart(width, "0");
}

export function segmentsToSRT(segments: Segment[]) {
  return segments
    .map((seg, i) => {
      const start = formatTimeSRT(seg.start);
      const end = formatTimeSRT(seg.end);
      return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}

export function segmentsToVTT(segments: Segment[]) {
  const body = segments
    .map((seg) => {
      const start = formatTimeVTT(seg.start);
      const end = formatTimeVTT(seg.end);
      return `${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

export function segmentsToPlainText(segments: Segment[]) {
  return segments.map((s) => s.text.trim()).join("\n");
}
