import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { History, Trash2, RotateCcw, PackageOpen, X as XIcon } from "lucide-react";
import {
  adminListProductActivity,
  adminClearProductActivity,
  adminRestoreProductFromActivity,
} from "@/lib/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type ActivityRow = {
  id: string;
  product_id: string | null;
  action: string;
  details: Record<string, unknown>;
  product_snapshot: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: {
    label: "Товар создан",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  update: { label: "Товар изменён", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  delete: { label: "Товар удалён", color: "bg-red-500/10 text-red-500 border-red-500/30" },
  restore: {
    label: "Товар восстановлен",
    color: "bg-lime-500/10 text-lime-500 border-lime-500/30",
  },
  activate: {
    label: "Товар активирован",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  deactivate: {
    label: "Товар отключён",
    color: "bg-red-500/10 text-red-500 border-red-500/30",
  },
  stock_update: {
    label: "Остаток изменён",
    color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  },
  move: {
    label: "Товар перемещён",
    color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30",
  },
  copy: {
    label: "Товар скопирован",
    color: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  },
  bulk_update_image: {
    label: "Массовое фото",
    color: "bg-teal-500/10 text-teal-500 border-teal-500/30",
  },
  bulk_update_brand: {
    label: "Массовый бренд",
    color: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  },
  bulk_update_description: {
    label: "Массовое описание",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  },
};

const FIELD_LABELS: Record<string, string> = {
  name: "Название",
  slug: "Slug",
  brand: "Бренд",
  category: "Категория",
  subcategory: "Подкатегория",
  price: "Цена",
  flavor: "Вкус",
  puffs: "Затяжки",
  volume: "Объём",
  emoji: "Эмодзи",
  color: "Цвет",
  image_url: "Картинка",
  description: "Описание",
  is_active: "Активность",
  sort_order: "Порядок сортировки",
  stock_quantity: "Остаток на складе",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key === "is_active") return value ? "Да" : "Нет";
  if (key === "image_url") return value ? "Обновлено" : "Удалено";
  if (typeof value === "string" && value.length > 80) return value.slice(0, 80) + "…";
  return String(value);
}

export const Route = createFileRoute("/_authenticated/admin/recent-actions")({
  component: RecentActionsPage,
});

function RecentActionsPage() {
  const listActivity = useServerFn(adminListProductActivity);
  const clearActivity = useServerFn(adminClearProductActivity);
  const restoreFromActivity = useServerFn(adminRestoreProductFromActivity);

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [selectedRestoreId, setSelectedRestoreId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const data = (await listActivity()) as unknown as ActivityRow[];
      setRows(data);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Ошибка загрузки истории");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deletedItems = useMemo(() => rows.filter((r) => r.action === "delete"), [rows]);

  function buildDetailsText(row: ActivityRow): string {
    const meta = ACTION_LABELS[row.action] || { label: row.action };
    const details = row.details || {};
    if (row.action === "update") {
      const changed = Array.isArray(details.changed_fields)
        ? (details.changed_fields as string[])
        : [];
      if (changed.length === 0) return `${meta.label}: изменений нет`;
      const parts = changed.map(
        (f: string) =>
          `${FIELD_LABELS[f] || f}: «${formatValue(f, (details.changes as Array<{ field: string; newValue: unknown }> | undefined)?.find((c) => c.field === f)?.newValue)}»`,
      );
      return `${meta.label}: ${parts.join(", ")}`;
    }
    if (row.action === "delete") {
      return `${meta.label}: «${details.name || "Без названия"}»`;
    }
    if (row.action === "stock_update") {
      return `${meta.label}: «${details.name || "Без названия"}» было ${details.old_stock_quantity ?? "?"}, стало ${details.new_stock_quantity ?? "?"}`;
    }
    if (row.action === "move") {
      return `${meta.label}: «${details.name || "Без названия"}» → ${details.targetCategory || "?"}${details.targetSubcategory ? ` · ${details.targetSubcategory}` : ""}`;
    }
    if (row.action === "copy") {
      return `${meta.label}: «${details.name || "Без названия"}» → ${details.targetCategory || "?"}${details.targetSubcategory ? ` · ${details.targetSubcategory}` : ""}`;
    }
    if (row.action === "restore") {
      return `${meta.label}: «${details.name || "Без названия"}»`;
    }
    if (row.action === "bulk_update_description") {
      return `${meta.label}: товаров обновлено: ${details.count ?? "?"}`;
    }
    if (row.action === "bulk_update_brand") {
      return `${meta.label}: «${details.brand || "—"}» (${details.count ?? "?"} шт.)`;
    }
    if (row.action === "bulk_update_image") {
      return `${meta.label}: товаров обновлено: ${details.count ?? "?"}`;
    }
    if (details.name) return `${meta.label}: «${details.name}»`;
    return meta.label;
  }

  async function handleRestore(id: string) {
    setSelectedRestoreId(id);
    setRestoreConfirmOpen(true);
  }

  async function confirmRestore() {
    if (!selectedRestoreId) return;
    setRestoringId(selectedRestoreId);
    setRestoreConfirmOpen(false);
    try {
      await restoreFromActivity({ data: { id: selectedRestoreId } });
      toast.success("Товар восстановлен");
      await reload();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Не удалось восстановить");
    } finally {
      setRestoringId(null);
      setSelectedRestoreId(null);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await clearActivity();
      toast.success("История очищена");
      setRows([]);
      setConfirmClearOpen(false);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Не удалось очистить историю");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Toaster position="top-center" theme="dark" richColors />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl flex items-center gap-2">
          <History className="w-5 h-5" /> Недавние действия
        </h1>
        <div className="flex items-center gap-2">
          {deletedItems.length > 0 && (
            <span className="text-xs font-semibold text-destructive">
              Удалённых: {deletedItems.length}
            </span>
          )}
          <button
            onClick={() => setConfirmClearOpen(true)}
            disabled={rows.length === 0 || clearing}
            className="inline-flex items-center gap-1.5 bg-destructive/20 text-destructive font-bold px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" /> Очистить историю
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Пока нет записей о действиях</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const meta = ACTION_LABELS[row.action] || {
              label: row.action,
              color: "bg-muted text-muted-foreground border-border",
            };
            const isDeleted = row.action === "delete";
            const isRestoring = restoringId === row.id;

            return (
              <div
                key={row.id}
                className={`bg-card border rounded-xl p-3 flex items-start gap-3 ${isDeleted ? "border-destructive/40 bg-destructive/5" : "border-border"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(row.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground break-words">{buildDetailsText(row)}</p>
                  {row.product_snapshot && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Slug: {row.product_snapshot.slug} · Цена:{" "}
                      {Number(row.product_snapshot.price).toFixed(2)} BYN
                    </p>
                  )}
                </div>
                {isDeleted && (
                  <button
                    onClick={() => handleRestore(row.id)}
                    disabled={isRestoring}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 font-bold px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {isRestoring ? "Восстановление…" : "Восстановить"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-base">Очистить историю действий</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Вы действительно хотите удалить все записи недавних действий? Это действие нельзя
            отменить.
          </p>
          <DialogFooter>
            <button
              onClick={() => setConfirmClearOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-muted font-semibold text-xs"
            >
              Отмена
            </button>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-bold text-xs disabled:opacity-40"
            >
              {clearing ? "Очистка…" : "Очистить"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-base">Восстановить товар</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Вы хотите восстановить удалённый товар? Он появится в каталоге как новый товар.
          </p>
          <DialogFooter>
            <button
              onClick={() => setRestoreConfirmOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-muted font-semibold text-xs"
            >
              Отмена
            </button>
            <button
              onClick={confirmRestore}
              disabled={!!restoringId}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-bold text-xs disabled:opacity-40"
            >
              Восстановить
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
