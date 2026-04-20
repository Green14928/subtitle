// 嚴格模式：用 gpt-4o-mini 看完整詞庫，把整篇逐字稿重校
// 參考 OpenAI 官方 Cookbook: Whisper Correct Misspelling
// 關鍵設計：逐行編號 → 要求 LLM 回同樣行數的校正版 → 時間軸保留
import OpenAI from "openai";
import type { Segment } from "./srt";
import type { TermEntry } from "./keyword-correct";

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 未設定");
  return new OpenAI({ apiKey: key });
}

// 一批最多丟 N 段，避免 LLM 輸出過長
const BATCH_SIZE = 40;

export async function correctWithLLM(
  segments: Segment[],
  entries: TermEntry[]
): Promise<Segment[]> {
  if (segments.length === 0 || entries.length === 0) return segments;
  const openai = getClient();

  // 組詞庫清單給 LLM 看
  const glossary = entries
    .map((e) => {
      const aliases = e.aliases.length > 0 ? `（常被誤寫成：${e.aliases.join("、")}）` : "";
      return `- ${e.text}${aliases}`;
    })
    .join("\n");

  const result: Segment[] = [];

  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    const batch = segments.slice(i, i + BATCH_SIZE);
    const numbered = batch.map((s, idx) => `${idx + 1}. ${s.text}`).join("\n");

    const systemPrompt = `你是一個字幕校對員。你會收到「專有名詞詞庫」和一段字幕逐字稿。

任務：只把字幕中「**明顯聽錯**」的專有名詞改成詞庫裡的正確寫法，其它保持原樣。

規則：
1. 只改詞庫有的詞，其它字**一個都不要動**（不修錯別字、不加標點、不重排）
2. 只有聽起來幾乎一樣才改（例：梅卡巴→梅爾卡巴）；看起來沾邊但可能是別的意思就別動（例：原文「開車」不要改成「開脈輪」）
3. 回覆格式：原樣保留行號，每行一句。行數必須和輸入完全一樣。
4. 不要加任何解釋、前後綴、markdown。只回字幕本身。`;

    const userPrompt = `【詞庫】
${glossary}

【原始字幕（共 ${batch.length} 行）】
${numbered}

【請輸出校正後的 ${batch.length} 行】`;

    let corrected: string[] = [];
    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const out = resp.choices[0]?.message?.content || "";
      corrected = parseLLMOutput(out, batch.length);
    } catch (e) {
      console.error("[llm-correct] batch failed, using original", e);
      corrected = batch.map((s) => s.text);
    }

    // 對齊回原本的 segment，只覆蓋 text
    for (let j = 0; j < batch.length; j++) {
      result.push({
        start: batch[j].start,
        end: batch[j].end,
        text: corrected[j] ?? batch[j].text,
      });
    }
  }

  return result;
}

// 解 LLM 輸出：每行開頭可能有「1.」「1、」「1)」等，移除後回傳
function parseLLMOutput(raw: string, expected: number): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const cleaned = lines.map((l) => l.replace(/^\s*\d+\s*[\.、\)]\s*/, "").trim());

  // 如果 LLM 行數不對就用原文長度填滿（避免對齊爆掉）
  if (cleaned.length < expected) {
    while (cleaned.length < expected) cleaned.push("");
  }
  return cleaned.slice(0, expected);
}
