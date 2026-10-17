import { useState, useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventSettings,
  adminUpdateEventSettings,
  requireAdminAccess,
  type EventSettings,
} from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/events")({
  beforeLoad: async () => {
    try {
      await requireAdminAccess();
    } catch {
      throw redirect({ to: "/" });
    }
  },
  component: EventsPage,
});

export function AdminEvents() {
  return <EventsPage />;
}

export function EventsPage() {
  const getEvt = useServerFn(getEventSettings);
  const updateEvt = useServerFn(adminUpdateEventSettings);
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("Halloween");
  const [startAt, setStartAt] = useState("2026-10-31T00:00");
  const [endAt, setEndAt] = useState("2026-11-02T00:00");
  const [theme, setTheme] = useState("halloween");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEvt()
      .then((s: EventSettings) => {
        setEnabled(!!s.enabled);
        setName(s.name || "Halloween");
        setStartAt((s.start_at || "").slice(0, 16));
        setEndAt((s.end_at || "").slice(0, 16));
        setTheme(s.theme || "halloween");
      })
      .catch(() => toast.error("Не удалось загрузить настройки ивента"))
      .finally(() => setLoading(false));
  }, [getEvt]);

  async function save() {
    setSaving(true);
    try {
      await updateEvt({
        data: {
          enabled,
          name: name.trim(),
          start_at: startAt,
          end_at: endAt,
          theme: theme.trim(),
        },
      });
      const fresh = await getEvt();
      setEnabled(!!fresh.enabled);
      setName(fresh.name || "Halloween");
      setStartAt((fresh.start_at || "").slice(0, 16));
      setEndAt((fresh.end_at || "").slice(0, 16));
      setTheme(fresh.theme || "halloween");
      toast.success("Сохранено");
    } catch (e) {
      console.error(e);
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = typeof window !== "undefined" ? `${window.location.origin}/event` : "/event";

  if (loading) return <div className="text-muted-foreground">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Ивенты</h1>
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            id="eventEnabled"
            name="eventEnabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="font-semibold">Включить ивент</span>
        </label>

        <div>
          <label className="text-sm text-muted-foreground">Название</label>
          <input
            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">
              Начало (таймер до этого момента)
            </label>
            <input
              type="datetime-local"
              className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Конец (когда дизайн отключится)</label>
            <input
              type="datetime-local"
              className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Тема</label>
          <input
            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-60"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-lg bg-muted font-bold"
          >
            Тест ивента
          </a>
        </div>
      </div>
    </div>
  );
}
