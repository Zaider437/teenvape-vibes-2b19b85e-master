import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  adminGetMeetingTimes,
  adminUpdateMeetingTimes,
  getAnimationSettings,
  adminUpdateAnimationSettings,
  adminGetCategoryOrder,
  adminUpdateCategoryOrder,
  adminListProducts,
  DEFAULT_CATEGORY_ORDER,
} from "@/lib/admin.functions";
import { invalidateProductsCache } from "@/lib/products";

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  disposable: { label: "Одноразки", emoji: "💨" },
  device: { label: "Устройства", emoji: "⚡" },
  liquid: { label: "Жидкости", emoji: "🧪" },
  consumable: { label: "Расходники", emoji: "🧩" },
  snus: { label: "Снюс", emoji: "🍃" },
};

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const getTimes = useServerFn(adminGetMeetingTimes);
  const updateTimes = useServerFn(adminUpdateMeetingTimes);
  const getAnim = useServerFn(getAnimationSettings);
  const updateAnim = useServerFn(adminUpdateAnimationSettings);
  const getCatOrder = useServerFn(adminGetCategoryOrder);
  const updateCatOrder = useServerFn(adminUpdateCategoryOrder);
  const listProducts = useServerFn(adminListProducts);

  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTime, setNewTime] = useState("");

  // Animation settings states
  const [leavesEnabled, setLeavesEnabled] = useState(true);
  const [leavesFrom, setLeavesFrom] = useState(9);
  const [leavesTo, setLeavesTo] = useState(11);
  const [leavesCount, setLeavesCount] = useState(30);

  const [snowEnabled, setSnowEnabled] = useState(true);
  const [snowFrom, setSnowFrom] = useState(12);
  const [snowTo, setSnowTo] = useState(2);
  const [snowCount, setSnowCount] = useState(40);

  async function load() {
    setLoading(true);
    try {
      const [savedOrder, timesData, animData, productsData] = await Promise.all([
        getCatOrder(),
        getTimes(),
        getAnim(),
        listProducts().catch(() => []),
      ]);
      setTimes(timesData);

      const allKnown = new Set([
        ...(savedOrder ?? []),
        ...DEFAULT_CATEGORY_ORDER,
        ...((productsData as any[]) ?? []).map((p: any) => p.category).filter(Boolean),
      ]);
      setCategoryOrder(Array.from(allKnown));

      if (animData) {
        setLeavesEnabled(animData.leaves.enabled);
        setLeavesFrom(animData.leaves.from);
        setLeavesTo(animData.leaves.to);
        setLeavesCount(animData.leaves.count ?? 30);
        setSnowEnabled(animData.snow.enabled);
        setSnowFrom(animData.snow.from);
        setSnowTo(animData.snow.to);
        setSnowCount(animData.snow.count ?? 40);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        updateTimes({ data: { times } }),
        updateCatOrder({ data: { categories: categoryOrder } }),
        updateAnim({
          data: {
            leaves: {
              enabled: leavesEnabled,
              from: Number(leavesFrom),
              to: Number(leavesTo),
              count: Number(leavesCount),
            },
            snow: {
              enabled: snowEnabled,
              from: Number(snowFrom),
              to: Number(snowTo),
              count: Number(snowCount),
            },
          },
        }),
      ]);
      invalidateProductsCache();
      toast.success("Настройки сохранены");
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  function addTime() {
    const val = newTime.trim();
    if (!val) return;
    if (times.includes(val)) {
      toast.error("Такое время уже есть");
      return;
    }
    setTimes([...times, val]);
    setNewTime("");
  }

  function removeTime(index: number) {
    setTimes(times.filter((_, i) => i !== index));
  }

  function moveCategory(index: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= categoryOrder.length) return;
    const copy = [...categoryOrder];
    const temp = copy[index];
    copy[index] = copy[nextIndex];
    copy[nextIndex] = temp;
    setCategoryOrder(copy);
  }

  function move(index: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= times.length) return;
    const copy = [...times];
    const temp = copy[index];
    copy[index] = copy[nextIndex];
    copy[nextIndex] = temp;
    setTimes(copy);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Toaster position="top-center" theme="dark" richColors />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Настройки сайта</h1>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm glow-pink disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">Загружаем настройки…</div>
      ) : (
        <div className="space-y-6">
          {/* Animation Settings Section */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="text-sm font-bold uppercase tracking-widest text-primary">
              Настройки анимации эффектов
            </div>

            {/* Leaves Animation */}
            <div className="space-y-3 border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold cursor-pointer select-none flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="leavesEnabled"
                    name="leavesEnabled"
                    checked={leavesEnabled}
                    onChange={(e) => setLeavesEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background"
                  />
                  Падающие листья 🍁
                </label>
              </div>
              {leavesEnabled && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <label
                      htmlFor="leavesFrom"
                      className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Месяц с (1-12)
                    </label>
                    <input
                      id="leavesFrom"
                      name="leavesFrom"
                      type="number"
                      min="1"
                      max="12"
                      value={leavesFrom}
                      onChange={(e) =>
                        setLeavesFrom(Math.max(1, Math.min(12, Number(e.target.value))))
                      }
                      className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 mt-1 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="leavesTo"
                      className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Месяц по (1-12)
                    </label>
                    <input
                      id="leavesTo"
                      name="leavesTo"
                      type="number"
                      min="1"
                      max="12"
                      value={leavesTo}
                      onChange={(e) =>
                        setLeavesTo(Math.max(1, Math.min(12, Number(e.target.value))))
                      }
                      className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 mt-1 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {leavesEnabled && (
                <div className="pl-6 pt-2">
                  <label
                    htmlFor="leavesCount"
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Количество листьев: {leavesCount}
                  </label>
                  <input
                    id="leavesCount"
                    name="leavesCount"
                    type="range"
                    min="0"
                    max="100"
                    value={leavesCount}
                    onChange={(e) => setLeavesCount(Number(e.target.value))}
                    className="w-full mt-1 accent-primary"
                  />
                </div>
              )}
            </div>

            {/* Snow Animation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold cursor-pointer select-none flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="snowEnabled"
                    name="snowEnabled"
                    checked={snowEnabled}
                    onChange={(e) => setSnowEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background"
                  />
                  Падающий снег ❄️
                </label>
              </div>
              {snowEnabled && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <label
                      htmlFor="snowFrom"
                      className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Месяц с (1-12)
                    </label>
                    <input
                      id="snowFrom"
                      name="snowFrom"
                      type="number"
                      min="1"
                      max="12"
                      value={snowFrom}
                      onChange={(e) =>
                        setSnowFrom(Math.max(1, Math.min(12, Number(e.target.value))))
                      }
                      className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 mt-1 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="snowTo"
                      className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Месяц по (1-12)
                    </label>
                    <input
                      id="snowTo"
                      name="snowTo"
                      type="number"
                      min="1"
                      max="12"
                      value={snowTo}
                      onChange={(e) => setSnowTo(Math.max(1, Math.min(12, Number(e.target.value))))}
                      className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 mt-1 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {snowEnabled && (
                <div className="pl-6 pt-2">
                  <label
                    htmlFor="snowCount"
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Количество снега: {snowCount}
                  </label>
                  <input
                    id="snowCount"
                    name="snowCount"
                    type="range"
                    min="0"
                    max="100"
                    value={snowCount}
                    onChange={(e) => setSnowCount(Number(e.target.value))}
                    className="w-full mt-1 accent-primary"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Category Order Section */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div>
              <div className="text-sm font-bold text-foreground">Порядок каталогов на сайте</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Определяет порядок кнопок в меню каталога и очерёдность товаров при просмотре «Всё». Используйте стрелки ↑ и ↓, затем нажмите «Сохранить».
              </div>
            </div>

            {categoryOrder.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-4">
                Категории не найдены
              </div>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border bg-background/50 overflow-hidden">
                {categoryOrder.map((catId, idx) => {
                  const meta = CATEGORY_META[catId] || {
                    label: catId.charAt(0).toUpperCase() + catId.slice(1),
                    emoji: "📦",
                  };
                  return (
                    <div
                      key={catId}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 text-xs font-bold text-muted-foreground tabular-nums">
                          {idx + 1}.
                        </span>
                        <span className="text-base">{meta.emoji}</span>
                        <span className="text-sm font-semibold truncate">{meta.label}</span>
                        <span className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                          {catId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveCategory(idx, "up")}
                          disabled={idx === 0}
                          className="w-8 h-8 rounded-lg bg-muted grid place-items-center disabled:opacity-30 hover:bg-muted/80 transition-colors"
                          title="Переместить выше"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCategory(idx, "down")}
                          disabled={idx === categoryOrder.length - 1}
                          className="w-8 h-8 rounded-lg bg-muted grid place-items-center disabled:opacity-30 hover:bg-muted/80 transition-colors"
                          title="Переместить ниже"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meeting Times Section */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Добавить новое время встречи
              </div>
              <div className="flex gap-2">
                <input
                  id="new-meeting-time"
                  name="new-meeting-time"
                  type="text"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  placeholder="Например: 19:00 или После 21:00"
                  className="flex-1 bg-background border-2 border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addTime}
                  className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Добавить
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Список доступных времён
              </div>
              {times.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-4">
                  Список пуст. Добавьте время выше.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {times.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="text-sm font-semibold">{t}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => move(idx, "up")}
                          disabled={idx === 0}
                          className="w-8 h-8 rounded-lg bg-muted grid place-items-center disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => move(idx, "down")}
                          disabled={idx === times.length - 1}
                          className="w-8 h-8 rounded-lg bg-muted grid place-items-center disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeTime(idx)}
                          className="w-8 h-8 rounded-lg bg-destructive/20 text-destructive grid place-items-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
