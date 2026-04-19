// OpenAI Whisper API (whisper-1) 呼叫封裝
// 支援多 chunk 併接 + initial_prompt（身心靈詞庫校正）
import OpenAI from "openai";
import { createReadStream } from "fs";
import type { Segment } from "./srt";
import type { AudioChunk } from "./audio";

export type TranscribeOptions = {
  chunks: AudioChunk[];
  initialPrompt?: string;
  language?: string;
};

export type TranscribeResult = {
  segments: Segment[];
  language: string;
  text: string;
};

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY 未設定。請到 https://platform.openai.com/api-keys 申請。"
    );
  }
  return new OpenAI({ apiKey: key });
}

// 單一 chunk 辨識，回傳已調整 offset 的 segments
export async function transcribeOneChunk(
  chunk: AudioChunk,
  opts: { initialPrompt?: string; language?: string }
): Promise<{ segments: Segment[]; language: string }> {
  const openai = getClient();
  const res: any = await openai.audio.transcriptions.create({
    file: createReadStream(chunk.path) as any,
    model: "whisper-1",
    language: opts.language,
    prompt: opts.initialPrompt,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const segs = (res.segments || []) as Array<{
    start: number;
    end: number;
    text: string;
  }>;

  return {
    segments: segs.map((s) => ({
      start: s.start + chunk.startSec,
      end: s.end + chunk.startSec,
      text: (s.text || "").trim(),
    })),
    language: res.language || opts.language || "zh",
  };
}

// 多 chunk 依序辨識（無進度回報，想要進度請在外面自己迴圈）
export async function transcribeChunks(
  options: TranscribeOptions
): Promise<TranscribeResult> {
  const allSegments: Segment[] = [];
  let detectedLanguage = options.language || "zh";

  for (const chunk of options.chunks) {
    const res = await transcribeOneChunk(chunk, {
      initialPrompt: options.initialPrompt,
      language: options.language,
    });
    if (res.language) detectedLanguage = res.language;
    allSegments.push(...res.segments);
  }

  const merged = mergeSegments(allSegments);
  return {
    segments: merged,
    language: detectedLanguage,
    text: merged.map((s) => s.text).join(" "),
  };
}

// 合併 segments（理論上各 chunk 的 offset 已調整，直接按 start 排序即可）
export function mergeSegments(segs: Segment[]): Segment[] {
  return [...segs].sort((a, b) => a.start - b.start);
}

// 組合 prompt：把詞庫詞彙列表轉成一句「這段影片可能會提到：...」
// Whisper prompt 上限 224 tokens（英文約 224 詞、中文約 100-150 字），太長會被截斷
export function buildPromptFromTerms(terms: string[]): string {
  if (terms.length === 0) return "";
  const unique = Array.from(new Set(terms.map((t) => t.trim()).filter(Boolean)));
  // 保守截取：前 80 個詞，避免超過 token 限制
  const limited = unique.slice(0, 80);
  return `以下內容可能會提到這些專有名詞：${limited.join("、")}。`;
}
