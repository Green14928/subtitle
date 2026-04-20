// 詞庫替換：把 segment 裡的「常見錯字/alias」換成「正確寫法」
// 用在 normal 模式，不送 LLM 所以 $0 成本
import type { Segment } from "./srt";

export type TermEntry = {
  text: string;          // 正確寫法
  aliases: string[];     // 常見錯字
};

// 解析 DB 裡的 aliases 欄位（JSON 字串或 null）
export function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// 用 alias → 正確寫法的 map 替換整段字幕
// 長 alias 優先（避免「梅卡巴」先被部分替換成「梅爾卡巴」再被「梅卡」觸發第二次）
export function applyDictionary(segments: Segment[], entries: TermEntry[]): Segment[] {
  // 收集所有 (alias, canonical) pair，長度降序
  const pairs: { alias: string; canonical: string }[] = [];
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (!alias || alias === entry.text) continue;
      pairs.push({ alias, canonical: entry.text });
    }
  }
  pairs.sort((a, b) => b.alias.length - a.alias.length);

  if (pairs.length === 0) return segments;

  return segments.map((seg) => {
    let text = seg.text;
    for (const { alias, canonical } of pairs) {
      if (!text.includes(alias)) continue;
      text = text.split(alias).join(canonical);
    }
    return { ...seg, text };
  });
}
