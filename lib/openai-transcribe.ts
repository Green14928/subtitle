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

export async function transcribeChunks(
  options: TranscribeOptions
): Promise<TranscribeResult> {
  const openai = getClient();
  const allSegments: Segment[] = [];
  let detectedLanguage = options.language || "zh";

  for (const chunk of options.chunks) {
    const res: any = await openai.audio.transcriptions.create({
      file: createReadStream(chunk.path) as any,
      model: "whisper-1",
      language: options.language,
      prompt: options.initialPrompt,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    if (res.language) detectedLanguage = res.language;

    const segs = (res.segments || []) as Array<{
      start: number;
      end: number;
      text: string;
    }>;

    for (const s of segs) {
      allSegments.push({
        start: s.start + chunk.startSec,
        end: s.end + chunk.startSec,
        text: (s.text || "").trim(),
      });
    }
  }

  return {
    segments: allSegments,
    language: detectedLanguage,
    text: allSegments.map((s) => s.text).join(" "),
  };
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
