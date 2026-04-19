// Replicate WhisperX 整合
// 需要 REPLICATE_API_TOKEN 環境變數
// 使用 victor-upmeet/whisperx 模型（支援 initial_prompt + word-level timestamps）

import Replicate from "replicate";
import type { Segment } from "./srt";

const MODEL =
  "victor-upmeet/whisperx:9aa6ecadd30610b81119fc1b6807302fd18ca6cbb39b3216f430dcf23618cedd";

export type TranscribeOptions = {
  audioUrl: string; // public URL to audio/video file
  initialPrompt?: string; // 身心靈詞庫 prompt
  language?: string; // "zh" for Chinese
};

export type TranscribeResult = {
  segments: Segment[];
  language: string;
  text: string;
};

export function getReplicate() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      "REPLICATE_API_TOKEN 未設定。請到 https://replicate.com/account/api-tokens 申請，然後加到 .env.local"
    );
  }
  return new Replicate({ auth: token });
}

export async function transcribe(
  options: TranscribeOptions
): Promise<TranscribeResult> {
  const replicate = getReplicate();

  const output = (await replicate.run(MODEL, {
    input: {
      audio_file: options.audioUrl,
      language: options.language || "zh",
      initial_prompt: options.initialPrompt,
      align_output: true,
      diarization: false,
      batch_size: 8,
      temperature: 0,
    },
  })) as any;

  // WhisperX 回傳格式：
  // { segments: [{ start, end, text, words: [...] }], detected_language: "zh" }
  const segments: Segment[] = (output.segments || []).map((s: any) => ({
    start: s.start,
    end: s.end,
    text: s.text,
  }));

  return {
    segments,
    language: output.detected_language || options.language || "zh",
    text: segments.map((s) => s.text).join(" "),
  };
}

// 組合 prompt：把詞庫詞彙列表轉成一句「這段影片可能會提到：...」
export function buildPromptFromTerms(terms: string[]): string {
  if (terms.length === 0) return "";
  const unique = Array.from(new Set(terms.map((t) => t.trim()).filter(Boolean)));
  return `以下內容可能會提到這些專有名詞：${unique.join("、")}。`;
}
