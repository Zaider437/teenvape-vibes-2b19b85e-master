import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const OUR_CHANNEL = "https://t.me/LV6634";

export const Route = createFileRoute("/passer")({
  component: PasserPage,
});

function PasserPage() {
  const [input, setInput] = useState("");
  const [passerUrl, setPasserUrl] = useState("");

  const generate = () => {
    const from = input.trim();
    if (!from) return;
    const url = `${window.location.origin}/pass?from=${encodeURIComponent(from)}&to=${encodeURIComponent(OUR_CHANNEL)}`;
    setPasserUrl(url);
  };

  const copy = async () => {
    if (!passerUrl) return;
    try {
      await navigator.clipboard.writeText(passerUrl);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="font-display text-2xl text-center">Софт-пассер</h1>
        <p className="text-muted-foreground text-sm text-center">
          Вставьте ссылку чужого Telegram-канала — получите ссылку-пассер, которая перекинет людей в наш канал.
        </p>
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://t.me/чужой_канал"
          className="w-full h-11 rounded-xl bg-card border border-border text-sm text-foreground px-3 focus:outline-none focus:border-primary/60"
        />
        <button
          onClick={generate}
          className="w-full bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-3 rounded-xl glow-soft"
        >
          Создать пассер
        </button>
        {passerUrl && (
          <div className="space-y-2">
            <input
              readOnly
              value={passerUrl}
              className="w-full h-11 rounded-xl bg-card border border-border text-xs text-foreground px-3"
            />
            <button
              onClick={copy}
              className="w-full bg-muted text-foreground font-bold uppercase tracking-widest text-xs py-2 rounded-xl border border-border"
            >
              Копировать
            </button>
            <a
              href={passerUrl}
              className="block text-center text-primary text-xs underline"
            >
              Проверить переход
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
