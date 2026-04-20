"use client";
import { useEffect, useMemo, useState } from "react";
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
  aliases: string | null;
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

export function DictionaryClient({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newTermText, setNewTermText] = useState("");
  const [newTermCat, setNewTermCat] = useState<string>(
    initialCategories[0]?.id ?? ""
  );
  const [newTermNotes, setNewTermNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  // 把所有分類的 terms 拉成 flat list（帶上分類名稱）
  const allTerms = useMemo(() => {
    return categories.flatMap((c) =>
      c.terms.map((t) => ({ ...t, catName: c.name }))
    );
  }, [categories]);

  const filtered = useMemo(() => {
    return allTerms.filter((t) => {
      const matchCat = cat === "all" ? true : t.categoryId === cat;
      const matchQ =
        !q ||
        t.text.includes(q) ||
        parseAliases(t.aliases).some((a) => a.includes(q));
      return matchCat && matchQ;
    });
  }, [allTerms, cat, q]);

  // ─── Category CRUD ──────────────────────────
  async function createCategory() {
    if (!newCatName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCatName.trim(),
          description: newCatDesc.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const c = await res.json();
      const created: Category = { ...c, terms: [], _count: { terms: 0 } };
      setCategories((prev) => [...prev, created]);
      setCat(created.id);
      setNewCatOpen(false);
      setNewCatName("");
      setNewCatDesc("");
      if (!newTermCat) setNewTermCat(created.id);
      toast.success("分類已建立");
    } catch {
      toast.error("建立分類失敗");
    } finally {
      setLoading(false);
    }
  }

  async function updateCategory(
    id: string,
    data: { name: string; description: string | null }
  ) {
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const upd = await res.json();
      setCategories((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, name: upd.name, description: upd.description }
            : c
        )
      );
      setEditingCatId(null);
      toast.success("已更新分類");
    } catch {
      toast.error("更新失敗");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCategory(id: string, name: string) {
    if (
      !confirm(`確定刪除分類「${name}」？裡面所有字詞都會一起刪除。`)
    )
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (cat === id) setCat("all");
      toast.success("已刪除");
    } catch {
      toast.error("刪除失敗");
    } finally {
      setLoading(false);
    }
  }

  // ─── Term CRUD ──────────────────────────────
  async function addTerm() {
    if (!newTermText.trim() || !newTermCat) return;
    setLoading(true);
    try {
      const texts = newTermText
        .split(/[\n,，、]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: newTermCat, texts }),
      });
      if (!res.ok) throw new Error();
      // 回抓這個分類的 terms 好拿到完整 id
      const refreshed = await fetch(`/api/terms?categoryId=${newTermCat}`);
      if (refreshed.ok) {
        const list: Term[] = await refreshed.json();
        setCategories((prev) =>
          prev.map((c) =>
            c.id === newTermCat
              ? { ...c, terms: list, _count: { terms: list.length } }
              : c
          )
        );
      }
      setNewTermText("");
      setNewTermNotes("");
      setAdding(false);
      toast.success(`已新增 ${texts.length} 個字詞`);
    } catch {
      toast.error("新增失敗");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTerm(id: string, categoryId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/terms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                terms: c.terms.filter((t) => t.id !== id),
                _count: { terms: c._count.terms - 1 },
              }
            : c
        )
      );
      if (expandedTerm === id) setExpandedTerm(null);
      toast.success("已刪除");
    } catch {
      toast.error("刪除失敗");
    } finally {
      setLoading(false);
    }
  }

  async function saveAliases(term: Term, aliases: string[]) {
    setLoading(true);
    try {
      const res = await fetch(`/api/terms/${term.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aliases }),
      });
      if (!res.ok) throw new Error();
      const upd: Term = await res.json();
      setCategories((prev) =>
        prev.map((c) =>
          c.id === upd.categoryId
            ? { ...c, terms: c.terms.map((t) => (t.id === term.id ? upd : t)) }
            : c
        )
      );
      toast.success("已儲存常見錯字");
    } catch {
      toast.error("儲存失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dict-layout">
      {/* ─── Sidebar ────────────────────────── */}
      <aside className="dict-sidebar">
        <div className="section-label">
          <span>CATEGORIES</span>
          <button
            onClick={() => setNewCatOpen((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--product)",
              cursor: "pointer",
              fontSize: 10,
              letterSpacing: 1,
            }}
          >
            + 新增
          </button>
        </div>

        {newCatOpen && (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              background: "var(--bg)",
              borderRadius: "var(--radius)",
            }}
          >
            <input
              className="input"
              placeholder="分類名稱"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              autoFocus
              style={{ marginBottom: 6 }}
            />
            <input
              className="input"
              placeholder="說明（可選）"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-primary"
                onClick={createCategory}
                disabled={loading || !newCatName.trim()}
                style={{ padding: "6px 12px", fontSize: 11 }}
              >
                建立
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setNewCatOpen(false);
                  setNewCatName("");
                  setNewCatDesc("");
                }}
                style={{ padding: "6px 12px", fontSize: 11 }}
              >
                取消
              </button>
            </div>
          </div>
        )}

        <button
          className={`cat-row ${cat === "all" ? "active" : ""}`}
          onClick={() => setCat("all")}
        >
          <span>全部</span>
          <span className="count">{allTerms.length}</span>
        </button>

        {categories.map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            selected={cat === c.id}
            editing={editingCatId === c.id}
            disabled={loading}
            onSelect={() => setCat(c.id)}
            onEdit={() => setEditingCatId(c.id)}
            onCancelEdit={() => setEditingCatId(null)}
            onSave={(data) => updateCategory(c.id, data)}
            onDelete={() => deleteCategory(c.id, c.name)}
          />
        ))}
      </aside>

      {/* ─── Main table ─────────────────────── */}
      <div className="dict-main">
        <div className="dict-toolbar">
          <input
            className="search-input"
            placeholder="搜尋字詞或錯字…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              if (categories.length === 0) {
                toast.error("請先建立分類");
                return;
              }
              setAdding((v) => !v);
              if (!newTermCat && categories[0]) setNewTermCat(categories[0].id);
            }}
          >
            {adding ? "取消" : "+ 新增字詞"}
          </button>
        </div>

        {adding && (
          <div
            style={{
              padding: 16,
              background: "var(--product-light)",
              borderBottom: "1px solid var(--border)",
              display: "grid",
              gridTemplateColumns: "2fr 140px 2fr auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              className="search-input"
              placeholder="字詞（可以一次貼多個，用逗號分隔）"
              value={newTermText}
              onChange={(e) => setNewTermText(e.target.value)}
              autoFocus
            />
            <select
              className="search-input"
              value={newTermCat}
              onChange={(e) => setNewTermCat(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className="search-input"
              placeholder="備註（可選）"
              value={newTermNotes}
              onChange={(e) => setNewTermNotes(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={addTerm}
              disabled={loading || !newTermText.trim() || !newTermCat}
            >
              新增
            </button>
          </div>
        )}

        <table className="word-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>字詞</th>
              <th style={{ width: "18%" }}>分類</th>
              <th>常見錯字</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "var(--text-muted)",
                    fontWeight: 400,
                  }}
                >
                  {allTerms.length === 0
                    ? "還沒有字詞，點右上「+ 新增字詞」開始"
                    : "沒有符合條件的字詞"}
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <TermRow
                  key={t.id}
                  term={t}
                  expanded={expandedTerm === t.id}
                  disabled={loading}
                  onToggle={() =>
                    setExpandedTerm(expandedTerm === t.id ? null : t.id)
                  }
                  onSave={(aliases) => saveAliases(t, aliases)}
                  onDelete={() => deleteTerm(t.id, t.categoryId)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  selected,
  editing,
  disabled,
  onSelect,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  category: Category;
  selected: boolean;
  editing: boolean;
  disabled: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: { name: string; description: string | null }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [desc, setDesc] = useState(category.description ?? "");

  useEffect(() => {
    setName(category.name);
    setDesc(category.description ?? "");
  }, [category.name, category.description]);

  if (editing) {
    return (
      <div
        style={{
          margin: "4px 0",
          padding: 10,
          background: "var(--bg)",
          borderRadius: "var(--radius)",
        }}
      >
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          style={{ marginBottom: 6 }}
        />
        <input
          className="input"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="說明"
          style={{ marginBottom: 6 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn-primary"
            onClick={() => onSave({ name: name.trim(), description: desc.trim() || null })}
            disabled={disabled || !name.trim()}
            style={{ padding: "6px 12px", fontSize: 11 }}
          >
            儲存
          </button>
          <button
            className="btn btn-ghost"
            onClick={onCancelEdit}
            style={{ padding: "6px 12px", fontSize: 11 }}
          >
            取消
          </button>
          <button
            className="btn btn-danger"
            onClick={onDelete}
            style={{ padding: "6px 12px", fontSize: 11, marginLeft: "auto" }}
          >
            刪除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <button
        type="button"
        className={`cat-row ${selected ? "active" : ""}`}
        onClick={onSelect}
        style={{ flex: 1 }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {category.name}
        </span>
        <span className="count">{category._count.terms}</span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        title="編輯分類"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: "4px 6px",
          fontSize: 11,
        }}
      >
        ✎
      </button>
    </div>
  );
}

function TermRow({
  term,
  expanded,
  disabled,
  onToggle,
  onSave,
  onDelete,
}: {
  term: Term & { catName?: string };
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
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

  function addAlias() {
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
    <>
      <tr>
        <td>
          <span className="word">{term.text}</span>
        </td>
        <td>
          <span className="tag">{term.catName || ""}</span>
        </td>
        <td
          style={{
            color: "var(--text-muted)",
            fontWeight: 400,
            fontSize: "var(--fs-xs)",
          }}
        >
          {initial.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {initial.map((a) => (
                <span key={a} className="alias-chip">
                  {a}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ opacity: 0.5 }}>—</span>
          )}
        </td>
        <td>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="icon-btn"
              title={expanded ? "收起" : "編輯錯字"}
              onClick={onToggle}
            >
              ✎
            </button>
            <button
              className="icon-btn"
              title="刪除"
              onClick={onDelete}
              disabled={disabled}
            >
              ×
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td
            colSpan={4}
            style={{
              background: "var(--bg)",
              padding: "16px 24px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              className="section-label"
              style={{ marginBottom: 8 }}
            >
              常見錯字 · 按 Enter 或逗號新增
            </div>
            <div className="alias-chips">
              {aliases.map((a) => (
                <span key={a} className="alias-chip">
                  {a}
                  <button onClick={() => removeAlias(a)} title="移除">
                    ×
                  </button>
                </span>
              ))}
              <input
                className="alias-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.nativeEvent.isComposing ||
                    (e.nativeEvent as KeyboardEvent).keyCode === 229
                  ) {
                    return;
                  }
                  if (e.key === "Enter" || e.key === "," || e.key === "，") {
                    e.preventDefault();
                    addAlias();
                  } else if (
                    e.key === "Backspace" &&
                    !input &&
                    aliases.length > 0
                  ) {
                    setAliases((prev) => prev.slice(0, -1));
                  }
                }}
                onBlur={addAlias}
                placeholder={
                  aliases.length === 0 ? "例：梅卡巴、梅卡巴巴" : ""
                }
              />
            </div>
            {dirty && (
              <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onSave(aliases)}
                  disabled={disabled}
                  style={{ padding: "6px 14px", fontSize: 11 }}
                >
                  儲存
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setAliases(initial);
                    setInput("");
                  }}
                  style={{ padding: "6px 14px", fontSize: 11 }}
                >
                  取消
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
