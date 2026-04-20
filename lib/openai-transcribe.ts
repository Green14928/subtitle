// OpenAI Whisper API (whisper-1) 呼叫封裝
// 使用 word-level + segment-level timestamps 以便重組精準字幕
import OpenAI from "openai";
import { createReadStream } from "fs";
import type { Segment } from "./srt";
import type { AudioChunk } from "./audio";

export type TranscribeOptions = {
  chunks: AudioChunk[];
  initialPrompt?: string;
  language?: string;
};

export type Word = {
  word: string;
  start: number;
  end: number;
};

export type TranscribeChunkResult = {
  words: Word[];
  segments: Segment[];
  language: string;
};

export type TranscribeResult = {
  words: Word[];
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

// 單一 chunk 辨識，回傳 word + segment 都 offset 完
export async function transcribeOneChunk(
  chunk: AudioChunk,
  opts: { initialPrompt?: string; language?: string }
): Promise<TranscribeChunkResult> {
  const openai = getClient();
  const res: any = await openai.audio.transcriptions.create({
    file: createReadStream(chunk.path) as any,
    model: "whisper-1",
    language: opts.language,
    prompt: opts.initialPrompt,
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
  });

  const rawWords = (res.words || []) as Array<{
    word: string;
    start: number;
    end: number;
  }>;
  const rawSegs = (res.segments || []) as Array<{
    start: number;
    end: number;
    text: string;
  }>;

  return {
    words: rawWords.map((w) => ({
      word: w.word,
      start: w.start + chunk.startSec,
      end: w.end + chunk.startSec,
    })),
    segments: rawSegs.map((s) => ({
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
  const allWords: Word[] = [];
  const allSegments: Segment[] = [];
  let detectedLanguage = options.language || "zh";

  for (const chunk of options.chunks) {
    const res = await transcribeOneChunk(chunk, {
      initialPrompt: options.initialPrompt,
      language: options.language,
    });
    if (res.language) detectedLanguage = res.language;
    allWords.push(...res.words);
    allSegments.push(...res.segments);
  }

  const sortedWords = [...allWords].sort((a, b) => a.start - b.start);
  const merged = mergeSegments(allSegments);
  return {
    words: sortedWords,
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
// 最重要的詞要放前面，Whisper 對 prompt 前半段 bias 更強
export function buildPromptFromTerms(terms: string[]): string {
  if (terms.length === 0) return "";
  const unique = Array.from(new Set(terms.map((t) => t.trim()).filter(Boolean)));
  const limited = unique.slice(0, 80);
  return `以下是這段內容可能出現的專有名詞，請嚴格照這些拼寫：${limited.join("、")}。`;
}
