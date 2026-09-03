import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, X as XIcon, Factory } from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  adminListManufacturers,
  adminUpsertManufacturer,
  adminDeleteManufacturer,
} from "@/lib/admin.functions";

type Manufacturer = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Draft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY: Draft = {
  name: "",
  slug: "",
  description: "",
  image_url: "",
  sort_order: "0",
  is_active: true,
};

export const Route = createFileRoute("/_authenticated/admin/manufacturers")({
  component: ManufacturersAdmin,
});

function ManufacturersAdmin() {
  const list = useServerFn(adminListManufacturers);
  const upsert = useServerFn(adminUpsertManufacturer);
  const remove = useServerFn(adminDeleteManufacturer);

  const [rows, setRows] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  async function reload(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = (await list()) as unknown as Manufacturer[];
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка загрузки");
    } finally {
      if (!silent) setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.slug, r.description].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [rows, query]);

  function edit(row: Manufacturer) {
    setDraft({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      image_url: row.image_url ?? "",
      sort_order: String(row.sort_order ?? 0),
      is_active: row.is_active,
    });
  }

  async function save() {
    if (!draft) return;
    const isEdit = !!draft.id;
    const saved: Manufacturer = {
      id: draft.id || "",
      name: draft.name.trim(),
      slug: draft.slug.trim(),
      description: draft.description.trim() || null,
      image_url: draft.image_url.trim() || null,
      sort_order: Number(draft.sort_order) || 0,
      is_active: draft.is_active,
      created_at: "",
      updated_at: "",
    };

    if (isEdit) {
      setRows((prev) => prev.map((r) => (r.id === draft.id ? saved : r)));
    } else {
      setRows((prev) => [...prev, saved].sort((a, b) => a.sort_order - b.sort_order));
    }

    setDraft(null);
    try {
      await upsert({
        data: {
          id: draft.id,
          name: draft.name.trim(),
          slug: draft.slug.trim(),
          description: draft.description.trim() || null,
          image_url: draft.image_url.trim() || null,
          sort_order: Number(draft.sort_order) || 0,
          is_active: draft.is_active,
        },
      });
      toast.success(isEdit ? "Сохранено" : "Добавлено");
      await reload(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось сохранить");
      await reload();
    }
  }

  async function del(row: Manufacturer) {
    if (!confirm(`Удалить производителя «${row.name}»?`)) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    try {
      await remove({ data: { id: row.id } });
      toast.success("Удалено");
      await reload(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось удалить");
      await reload();
    }
  }

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  return (
    <div className="space-y-4">
      <Toaster position="top-center" theme="dark" richColors />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Factory className="w-5 h-5 text-primary" />
          <h1 className="font-display text-2xl">Производители</h1>
        </div>
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold px-3 py-1.5 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      <div className="relative">
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск производителя…"
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-muted grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((row) => (
            <div
              key={row.id}
              className={`bg-card border rounded-xl p-3 flex items-center gap-3 ${row.is_active ? "border-border" : "border-red-500/50 bg-red-500/5"}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{row.name}</div>
                <div className="text-xs text-muted-foreground">
                  /b/{row.slug}
                  {row.description ? ` · ${row.description}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => edit(row)}
                  className="w-9 h-9 rounded-lg grid place-items-center bg-muted"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => del(row)}
                  className="w-9 h-9 rounded-lg grid place-items-center bg-destructive/20 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Нет производителей</p>
          )}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-4 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-display text-xl">{draft.id ? "Редактировать" : "Новый производитель"}</h3>
              <button
                onClick={() => setDraft(null)}
                className="w-8 h-8 rounded-lg bg-muted grid place-items-center"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Название
              </span>
              <input
                id="name"
                name="name"
                type="text"
                value={draft.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({ ...draft, name: v, slug: draft.id ? draft.slug : generateSlug(v) });
                }}
                className="mt-1 w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Slug (URL)
              </span>
              <input
                id="slug"
                name="slug"
                type="text"
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                className="mt-1 w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Описание
              </span>
              <textarea
                id="description"
                name="description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className="mt-1 w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Изображение (путь в storage)
              </span>
              <input
                id="image_url"
                name="image_url"
                type="text"
                value={draft.image_url}
                onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                className="mt-1 w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Порядок сортировки
              </span>
              <input
                id="sort_order"
                name="sort_order"
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
                className="mt-1 w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              />
              <span>Активен</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-lg"
              >
                Сохранить
              </button>
              <button onClick={() => setDraft(null)} className="px-4 py-2.5 rounded-lg bg-muted font-semibold">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
