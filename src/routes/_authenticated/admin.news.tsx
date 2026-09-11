import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, X, ImageIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  adminListNews,
  adminUpsertNews,
  adminDeleteNews,
  adminUploadNewsImage,
} from "@/lib/admin.functions";

type NewsItem = {
  id: string;
  title: string;
  text: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Draft = {
  id?: string;
  title: string;
  text: string;
  image_url: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  text: "",
  image_url: "",
  sort_order: "0",
  is_active: true,
};

export const Route = createFileRoute("/_authenticated/admin/news")({
  component: AdminNews,
});

function AdminNews() {
  const listFn = useServerFn(adminListNews);
  const upsertFn = useServerFn(adminUpsertNews);
  const deleteFn = useServerFn(adminDeleteNews);
  const uploadFn = useServerFn(adminUploadNewsImage);

  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setLoading(true);
    try {
      const data = await listFn();
      setItems(data ?? []);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCreate() {
    setDraft({ ...EMPTY_DRAFT, sort_order: String(items.length) });
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startEdit(item: NewsItem) {
    setDraft({
      id: item.id,
      title: item.title,
      text: item.text,
      image_url: item.image_url || "",
      sort_order: String(item.sort_order),
      is_active: item.is_active,
    });
    setImagePreview(item.image_url);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function cancelEdit() {
    setDraft(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!draft) return;
    if (!draft.title.trim() || !draft.text.trim()) {
      toast.error("Заголовок и текст обязательны");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = draft.image_url || null;

      if (imagePreview && imagePreview.startsWith("data:")) {
        setUploading(true);
        try {
          const file = dataURLtoFile(imagePreview, "news-image.png");
          const formData = new FormData();
          formData.append("file", file);
          const result = await uploadFn({ data: formData });
          imageUrl = (result as { path?: string }).path || imageUrl;
        } catch (uploadErr) {
          toast.error((uploadErr as Error)?.message ?? "Ошибка загрузки изображения");
          setSaving(false);
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      await upsertFn({
        data: {
          id: draft.id,
          title: draft.title.trim(),
          text: draft.text.trim(),
          image_url: imageUrl,
          sort_order: Number(draft.sort_order) || 0,
          is_active: draft.is_active,
        },
      });

      toast.success(draft.id ? "Новость обновлена" : "Новость добавлена");
      setDraft(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await reload();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить эту новость?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Удалено");
      await reload();
      if (draft?.id === id) cancelEdit();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Не удалось удалить");
    }
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const copy = [...items];
    const temp = copy[index];
    copy[index] = copy[newIndex];
    copy[newIndex] = temp;
    setItems(copy);
  }

  async function saveOrder() {
    setSaving(true);
    try {
      const updates = items.map((item, idx) =>
        upsertFn({
          data: {
            id: item.id,
            title: item.title,
            text: item.text,
            image_url: item.image_url,
            sort_order: idx,
            is_active: item.is_active,
          },
        }),
      );
      await Promise.all(updates);
      toast.success("Порядок сохранён");
      await reload();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Не удалось сохранить порядок");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Toaster position="top-center" theme="dark" richColors />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Новости</h1>
        <div className="flex items-center gap-2">
          {items.length > 1 && (
            <button
              onClick={saveOrder}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-card hover:bg-muted text-foreground font-semibold px-3 py-1.5 rounded-lg text-sm border border-border transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Сохранить порядок
            </button>
          )}
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold px-3 py-1.5 rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" /> Добавить новость
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : items.length === 0 && !draft ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Нет новостей. Добавьте первую.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`bg-card border rounded-xl p-3 flex items-start gap-3 ${item.is_active ? "border-border" : "border-red-500/50 bg-red-500/5"}`}
            >
              <div className="flex flex-col gap-1 pt-1">
                <button
                  onClick={() => moveItem(idx, "up")}
                  disabled={idx === 0}
                  className="w-8 h-8 rounded-lg bg-muted grid place-items-center disabled:opacity-30 hover:bg-muted/80 transition-colors"
                  title="Переместить выше"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveItem(idx, "down")}
                  disabled={idx === items.length - 1}
                  className="w-8 h-8 rounded-lg bg-muted grid place-items-center disabled:opacity-30 hover:bg-muted/80 transition-colors"
                  title="Переместить ниже"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              <div className="w-14 h-14 rounded-lg bg-muted grid place-items-center text-xl shrink-0 overflow-hidden border border-border">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm leading-snug truncate">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.text}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(item)}
                  className="w-9 h-9 rounded-lg bg-muted grid place-items-center hover:bg-muted/80 transition-colors"
                  title="Редактировать"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="w-9 h-9 rounded-lg bg-destructive/20 text-destructive grid place-items-center hover:bg-destructive/30 transition-colors"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">
              {draft.id ? "Редактировать новость" : "Новая новость"}
            </h2>
            <button
              onClick={cancelEdit}
              className="w-8 h-8 rounded-lg bg-muted grid place-items-center hover:bg-muted/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="news-title"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                Заголовок
              </label>
              <input
                id="news-title"
                name="news-title"
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Например: Новая поставка"
                className="w-full mt-1 bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="news-text"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                Текст новости
              </label>
              <textarea
                id="news-text"
                name="news-text"
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                placeholder="Опишите новость..."
                rows={4}
                className="w-full mt-1 bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div>
              <label
                htmlFor="news-image"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                Фото новости
              </label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Рекомендуемый размер: 1200×675 px (соотношение 16:9) для десктопа, 800×600 px (4:3)
                для мобильных.
              </p>
              <input
                ref={fileInputRef}
                id="news-image"
                name="news-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="mt-1.5 text-xs text-foreground"
              />
              {imagePreview && (
                <div className="mt-2 relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 object-contain rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setDraft({ ...draft, image_url: "" });
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground grid place-items-center text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="news-sort"
                  className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Порядок
                </label>
                <input
                  id="news-sort"
                  name="news-sort"
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
                  className="w-full mt-1 bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background"
                  />
                  <span className="text-sm font-semibold">Активна</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm glow-soft disabled:opacity-50"
            >
              {saving || uploading
                ? "Сохраняем…"
                : draft.id
                  ? "Сохранить изменения"
                  : "Добавить новость"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
