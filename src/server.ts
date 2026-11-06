import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { Env } from "../cloudflare-env";
import { supabaseAdmin } from "./integrations/supabase/client.server";

type ServerEntry = {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

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
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/api/orders" || url.pathname === "/api/revenue") {
      const apiKey =
        (env as any).ONE_C_API_KEY ||
        (globalThis as any).ONE_C_API_KEY ||
        process.env.ONE_C_API_KEY;
      const provided =
        request.headers.get("x-api-key") || url.searchParams.get("key");
      if (!apiKey || provided !== apiKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      try {
        const since = url.searchParams.get("since");
        let query = supabaseAdmin
          .from("orders" as any)
          .select("id, created_at, customer_name, customer_phone, customer_address, items, total_amount, status, cancellation_token")
          .order("created_at", { ascending: true });
        if (since) query = query.gte("created_at", since);

        const { data, error } = await query;
        if (error) throw error;

        if (url.pathname === "/api/orders") {
          return new Response(JSON.stringify({ orders: data ?? [] }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        const map = new Map<string, { date: string; name: string; brand: string; qty: number; revenue: number }>();
        const dayTotals = new Map<string, number>();
        for (const o of data ?? []) {
          const r = o as Record<string, any>;
          if (r.status === "cancelled") continue;
          const date = String(r.created_at || "").slice(0, 10);
          const items = typeof r.items === "string" ? JSON.parse(r.items) : r.items || [];
          for (const i of items) {
            const key = `${date}|${i.id || ""}|${i.name || ""}`;
            const prev = map.get(key);
            const qty = Number(i.qty) || 0;
            const price = Number(i.price) || 0;
            const revenue = qty * price;
            if (prev) {
              prev.qty += qty;
              prev.revenue += revenue;
            } else {
              map.set(key, { date, name: String(i.name || ""), brand: String(i.brand || ""), qty, revenue });
            }
            dayTotals.set(date, (dayTotals.get(date) ?? 0) + revenue);
          }
        }
        const rows = Array.from(map.values())
          .sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date)))
          .map((a) => ({ ...a, dayTotal: dayTotals.get(a.date) ?? 0 }));
        return new Response(JSON.stringify({ revenue: rows }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: "Server error" }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    try {
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
