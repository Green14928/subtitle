// SRT / VTT 格式化工具

export type Segment = {
  start: number; // seconds
  end: number;
  text: string;
};

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
