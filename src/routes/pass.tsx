import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/pass")({
  validateSearch: (search: Record<string, unknown>) => ({
    to: typeof search.to === "string" ? search.to : "",
    delay: typeof search.delay === "number" ? search.delay : 3,
  }),
  component: PassPage,
});

function PassPage() {
  const { to, delay } = Route.useSearch();
  const [seconds, setSeconds] = useState(delay);

  useEffect(() => {
    if (!to) return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          window.location.replace(to);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [to, delay]);

  if (!to) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-display text-2xl">Нет ссылки для перехода</h1>
          <p className="text-muted-foreground text-sm">Добавьте параметр ?to=https://t.me/...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="font-display text-2xl">Переход в Telegram</h1>
        <p className="text-muted-foreground text-sm">
          Вы будете перенаправлены через {seconds} сек.
        </p>
        <a
          href={to}
          className="inline-flex items-center justify-center bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs px-6 py-3 rounded-full glow-soft"
        >
          Перейти сейчас
        </a>
      </div>
    </div>
  );
}
