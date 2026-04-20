"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function parseAliases(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

type Term = {
  id: string;
  text: string;
  aliases: string | null; // JSON array as string
  notes: string | null;
  categoryId: string;
};
type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  terms: Term[];
  _count: { terms: number };
};

const COLORS = [
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
];

export function DictionaryClient({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCategories[0]?.id ?? null
  );
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = categories.find((c) => c.id === selectedId);

  async function createCategory() {
    if (!newCatName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName, description: newCatDesc }),
      });
      if (!res.ok) throw new Error("建立失敗");
      toast.success("分類已建立");
      setNewCatOpen(false);
      setNewCatName("");
      setNewCatDesc("");
      router.refresh();
    } catch (e) {
      toast.error("建立分類失敗");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`確定要刪除分類「${name}」？分類裡的所有詞彙都會被刪除。`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("已刪除");
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
      router.refresh();
    } catch {
      toast.error("刪除失敗");
    } finally {
      setLoading(false);
    }
  }

  async function bulkAddTerms() {
    if (!selected) return;
    const texts = bulkText
      .split(/[\n,，、]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (texts.length === 0) {
      toast.error("請輸入至少一個詞彙");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: selected.id, texts }),
      });
      if (!res.ok) throw new Error();
      const { count } = await res.json();
      toast.success(`已新增 ${count} 個詞彙`);
      setBulkText("");
      router.refresh();
    } catch {
      toast.error("新增失敗");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTerm(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/terms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("已刪除");
      router.refresh();
    } catch {
      toast.error("刪除失敗");
    } finally {
      setLoading(false);
    }
  }

  async function saveAliases(termId: string, aliases: string[]) {
    setLoading(true);
    try {
      const res = await fetch(`/api/terms/${termId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aliases }),
      });
      if (!res.ok) throw new Error();
      toast.success("已儲存常見錯字");
      router.refresh();
    } catch {
      toast.error("儲存失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      {/* 左側：分類列表 */}
      <aside className="bg-white rounded-xl border border-slate-200 p-3 h-fit sticky top-20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 px-2">分類</h2>
          <button
            onClick={() => setNewCatOpen(true)}
            className="text-xs bg-violet-600 text-white px-2 py-1 rounded hover:bg-violet-700"
          >
            + 新增
          </button>
        </div>

        {newCatOpen && (
          <div className="mb-3 p-3 bg-slate-50 rounded-lg space-y-2">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="分類名稱，例：占星術語"
              className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
              autoFocus
            />
            <input
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="說明（可選）"
              className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
            />
            <div className="flex gap-2">
              <button
                onClick={createCategory}
                disabled={loading || !newCatName.trim()}
                className="flex-1 text-xs bg-violet-600 text-white px-2 py-1.5 rounded hover:bg-violet-700 disabled:opacity-50"
              >
                確定
              </button>
              <button
                onClick={() => {
                  setNewCatOpen(false);
                  setNewCatName("");
                  setNewCatDesc("");
                }}
                className="flex-1 text-xs bg-slate-200 text-slate-700 px-2 py-1.5 rounded hover:bg-slate-300"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {categories.length === 0 && !newCatOpen && (
          <p className="text-xs text-slate-500 p-3 text-center">
            還沒有分類，點「+ 新增」開始
          </p>
        )}

        <ul className="space-y-1">
          {categories.map((cat, idx) => (
            <li key={cat.id}>
              <button
                onClick={() => setSelectedId(cat.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${
                  selectedId === cat.id
                    ? "bg-violet-100 text-violet-900"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      COLORS[idx % COLORS.length].split(" ")[0]
                    }`}
                  />
                  <span className="truncate">{cat.name}</span>
                </span>
                <span className="text-xs text-slate-500">{cat._count.terms}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* 右側：詞彙列表 */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        {!selected ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">👈</div>
            <p>請先在左邊選一個分類，或新增一個分類</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selected.name}</h2>
                {selected.description && (
                  <p className="text-sm text-slate-600 mt-1">{selected.description}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  共 {selected.terms.length} 個詞彙
                </p>
              </div>
              <button
                onClick={() => deleteCategory(selected.id, selected.name)}
                className="text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded"
              >
                刪除此分類
              </button>
            </div>

            {/* 批量新增區 */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                批量新增詞彙
              </label>
              <p className="text-xs text-slate-500">
                一行一個，或用逗號、頓號分隔。例：梅爾卡巴、阿卡西記錄、昆達里尼
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"脈輪\n乙太體\n阿卡西記錄\n梅爾卡巴"}
                rows={4}
                className="w-full text-sm border border-slate-200 rounded px-3 py-2 font-mono"
              />
              <button
                onClick={bulkAddTerms}
                disabled={loading || !bulkText.trim()}
                className="bg-violet-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                新增到詞庫
              </button>
            </div>

            {/* 詞彙列表 */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-1">目前詞彙</h3>
              <p className="text-xs text-slate-500 mb-3">
                每個詞可以加「常見錯字」—— 選「正常」或「嚴格」比對模式時會把辨識結果的錯字自動換成正確寫法。
              </p>
              {selected.terms.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  還沒有詞彙，從上方批量新增開始 ☝️
                </p>
              ) : (
                <ul className="space-y-2">
                  {selected.terms.map((term) => (
                    <TermRow
                      key={term.id}
                      term={term}
                      disabled={loading}
                      onSave={(aliases) => saveAliases(term.id, aliases)}
                      onDelete={() => deleteTerm(term.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function TermRow({
  term,
  disabled,
  onSave,
  onDelete,
}: {
  term: Term;
  disabled: boolean;
  onSave: (aliases: string[]) => void;
  onDelete: () => void;
}) {
  const initial = parseAliases(term.aliases);
  const [aliases, setAliases] = useState<string[]>(initial);
  const [input, setInput] = useState("");

  useEffect(() => {
    setAliases(parseAliases(term.aliases));
  }, [term.aliases]);

  const dirty =
    aliases.length !== initial.length ||
    aliases.some((a, i) => a !== initial[i]);

  function addAliasFromInput() {
    const parts = input
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setAliases((prev) => Array.from(new Set([...prev, ...parts])));
    setInput("");
  }

  function removeAlias(a: string) {
    setAliases((prev) => prev.filter((x) => x !== a));
  }

  return (
    <li className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-violet-100 text-violet-900 px-2.5 py-1 rounded-full text-sm font-medium">
          {term.text}
        </span>
        <span className="text-xs text-slate-400">← 正確寫法</span>
        <button
          onClick={onDelete}
          disabled={disabled}
          className="ml-auto text-xs text-slate-400 hover:text-red-600 px-2 py-1"
          title="刪除整個詞"
        >
          ✕ 刪除
        </button>
      </div>
      <div>
        <label className="text-xs text-slate-600">
          常見錯字（按 Enter 或逗號新增）
        </label>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 p-2 border border-slate-200 rounded-md min-h-9">
          {aliases.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-xs"
            >
              {a}
              <button
                onClick={() => removeAlias(a)}
                className="text-amber-600 hover:text-red-600"
                title="移除"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "," || e.key === "，") {
                e.preventDefault();
                addAliasFromInput();
              } else if (e.key === "Backspace" && !input && aliases.length > 0) {
                setAliases((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={addAliasFromInput}
            placeholder={aliases.length === 0 ? "例：梅卡巴、梅卡巴巴" : ""}
            className="flex-1 min-w-40 text-xs outline-none bg-transparent"
          />
        </div>
        {dirty && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onSave(aliases)}
              disabled={disabled}
              className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded hover:bg-violet-700 disabled:opacity-50"
            >
              儲存
            </button>
            <button
              onClick={() => {
                setAliases(initial);
                setInput("");
              }}
              disabled={disabled}
              className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-300"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
