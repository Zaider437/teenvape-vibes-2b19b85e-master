import { createFileRoute } from "@tanstack/react-router";

function getEnv(key: string): string | undefined {
  const g = globalThis as Record<string, unknown>;
  return (
    (g[key] as string | undefined) ||
    ((g.env as Record<string, unknown> | undefined)?.[key] as string | undefined) ||
    ((g.__env__ as Record<string, unknown> | undefined)?.[key] as string | undefined) ||
    (typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)?.[key]
      : undefined)
  );
}

export const Route = createFileRoute("/game/telegram-config")({
  server: {
    handlers: {
      GET: async () => {
        let env: Record<string, unknown> = {};
        try {
          // @ts-expect-error vinxi/http is resolved at runtime by TanStack Start
          const { getEvent } = await import("vinxi/http");
          const event = getEvent();
          if (event) {
            env = {
              ...env,
              ...((event.context?.cloudflare?.env || event.context?.env || {}) as Record<
                string,
                unknown
              >),
            };
          }
        } catch {
          // ignore missing vinxi/http in dev
        }
        const botUsername = String(
          env.TELEGRAM_GAME_BOT_USERNAME ||
            getEnv("TELEGRAM_GAME_BOT_USERNAME") ||
            env.TELEGRAM_LOGIN_BOT_USERNAME ||
            getEnv("TELEGRAM_LOGIN_BOT_USERNAME") ||
            "gameeventlove_bot",
        ).replace(/^@/, "");
        return new Response(JSON.stringify({ botUsername }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
