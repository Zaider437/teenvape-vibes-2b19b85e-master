import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/pass")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
    delay: typeof search.delay === "number" ? search.delay : 3,
  }),
  component: PassPage,
});

function PassPage() {
  const { from, to, delay } = Route.useSearch();
  const [seconds, setSeconds] = useState(delay);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!to) return;
    const key = `pass_${from}_${to}`;
    const prev = Number(localStorage.getItem(key) || "0");
    setCount(prev + 1);
    localStorage.setItem(key, String(prev + 1));
  }, [from, to]);

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
        {from && (
          <p className="text-muted-foreground text-sm">
            Из канала <span className="text-primary font-bold">{from}</span> →{" "}
            <span className="text-primary font-bold">{to}</span>
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          Вы будете перенаправлены через {seconds} сек.
        </p>
        <p className="text-xs text-muted-foreground">Переходов: {count}</p>
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
