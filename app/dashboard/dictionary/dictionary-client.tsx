"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Term = { id: string; text: string; notes: string | null; categoryId: string };
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
              <h3 className="text-sm font-medium text-slate-700 mb-2">目前詞彙</h3>
              {selected.terms.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  還沒有詞彙，從上方批量新增開始 ☝️
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selected.terms.map((term) => (
                    <span
                      key={term.id}
                      className="group inline-flex items-center gap-1 bg-violet-50 text-violet-900 border border-violet-200 px-3 py-1.5 rounded-full text-sm"
                    >
                      {term.text}
                      <button
                        onClick={() => deleteTerm(term.id)}
                        className="opacity-0 group-hover:opacity-100 text-violet-500 hover:text-red-600 ml-1"
                        title="刪除"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
