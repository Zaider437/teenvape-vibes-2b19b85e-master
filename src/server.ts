import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
type ServerEntry = {
  fetch: (request: Request, env: any, ctx: any) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

// Бэкап фото после каждого деплоя: воркер «просыпается» холодным стартом,
// и если последний успешный бэкап был больше 20 часов назад — запускаем его в фоне.
let deployBackupTriggered = false;
function maybeRunDeployBackup(env: any, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
  if (deployBackupTriggered) return;
  deployBackupTriggered = true;
  ctx.waitUntil(
    (async () => {
      try {
        const { runPhotoBackupIfNeeded } = await import("./lib/photo-backup");
        const result = await runPhotoBackupIfNeeded(env);
        if (result) console.log("[photo-backup] deploy-startup result:", JSON.stringify(result));
      } catch (e) {
        console.warn("[photo-backup] deploy-startup skipped/failed", e);
      }
    })(),
  );
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function ensureUtf8Charset(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  if (contentType.includes("charset=utf-8") || contentType.includes("charset=utf8")) {
    return response;
  }
  const newHeaders = new Headers(response.headers);
  newHeaders.set("content-type", "text/html; charset=utf-8");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  // Ежедневный cron-бэкап (wrangler.toml → triggers.crons):
  // 1) полный дамп id→image_url в app_settings (независимый от журнала "бэкап ссылок"),
  // 2) автопочинка: битые ссылки заменяются живыми из дампа/истории.
  async scheduled(controller: unknown, env: any, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ctx.waitUntil(
      (async () => {
        try {
          const { runPhotoBackup } = await import("./lib/photo-backup");
          const result = await runPhotoBackup(env);
          console.log("[photo-backup] cron result:", JSON.stringify(result));
        } catch (e) {
          console.error("[photo-backup] cron failed", e);
        }
      })(),
    );
  },

  async fetch(request: Request, env: any, ctx: any) {
    try {
      maybeRunDeployBackup(env, ctx);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return ensureUtf8Charset(normalized);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
