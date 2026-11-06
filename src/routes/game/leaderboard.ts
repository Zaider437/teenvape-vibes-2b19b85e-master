import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const KEY = "game_leaderboard";

type Score = {
  name: string;
  score: number;
  date: string;
  tg_id?: number;
  tg_username?: string;
  tg_first_name?: string;
  tg_photo_url?: string;
};

async function readBoard(): Promise<Score[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw error;
  const val = (data as { value?: unknown } | null)?.value;
  const obj = val && typeof val === "object" ? (val as { scores?: unknown }) : null;
  const arr = Array.isArray(val) ? val : Array.isArray(obj?.scores) ? obj!.scores : [];
  const valid = (arr as Score[]).filter(
    (s) => s && typeof s.name === "string" && typeof s.score === "number",
  );
  const byKey = new Map<string, Score>();
  const anonymous: Score[] = [];
  for (const s of valid) {
    if (typeof s.tg_id === "number") {
      const key = `tg:${s.tg_id}`;
      const prev = byKey.get(key);
      if (!prev || s.score > prev.score || (s.score === prev.score && s.date > prev.date)) {
        byKey.set(key, s);
      }
    } else {
      anonymous.push(s);
    }
  }
  return [...byKey.values(), ...anonymous];
}

async function writeBoard(scores: Score[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert(
      { key: KEY, value: { scores }, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}

async function isAdminRequest(request: Request): Promise<boolean> {
  try {
    const auth = request.headers.get("authorization");
    const token = auth?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return false;
    const supabaseUrl = process.env.SUPABASE_URL || "https://ueazjqvxjlppgtkhcmut.supabase.co";
    const anonKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYXpqcXZ4amxwcGd0a2hjbXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDg2MjgsImV4cCI6MjA5OTc4NDYyOH0.jyJjCPse3Woz3ghOs3exBEGMImG7SSsa69BTlCvVx50";
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!userRes.ok) return false;
    const user = (await userRes.json()) as {
      id?: string;
      user_metadata?: { telegram_username?: string };
    };
    if (!user?.id) return false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: role } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (role) return true;
    const username = user.user_metadata?.telegram_username;
    if (username) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allowed } = await (supabaseAdmin as any).rpc("is_admin_telegram_username", {
        _username: username,
      });
      if (allowed) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/game/leaderboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const scores = await readBoard();
          const sorted = [...scores].sort((a, b) => b.score - a.score).slice(0, 15);
          const url = new URL(request.url);
          const viewer = url.searchParams.get("viewer");
          const viewerId = viewer ? Number(viewer) : null;
          const admin = await isAdminRequest(request);
          const privileged = admin;
          const out = sorted.map((s, i) => {
            const isTop3 = i < 3;
            let name = s.name;
            if (isTop3 && !privileged) name = "Игрок";
            const item: Record<string, unknown> = { name, score: s.score, date: s.date };
            if (isTop3 && privileged && (s.tg_username || s.tg_id)) {
              item.tg_username = s.tg_username;
              item.tg_id = s.tg_id;
              item.contact = s.tg_username
                ? `https://t.me/${s.tg_username}`
                : s.tg_id
                  ? `tg://user?id=${s.tg_id}`
                  : null;
            }
            return item;
          });
          return new Response(JSON.stringify({ scores: out }), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ scores: [], error: String(e) }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = z
            .object({
              name: z.string().trim().min(1).max(20),
              score: z.number().int().nonnegative(),
              telegram_id: z.number().optional(),
              telegram_username: z.string().trim().max(64).optional(),
              telegram_first_name: z.string().trim().max(64).optional(),
              telegram_photo_url: z.string().trim().max(512).optional(),
            })
            .safeParse(body);
          if (!parsed.success) {
            return new Response(JSON.stringify({ error: "invalid" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          const {
            name,
            score,
            telegram_id,
            telegram_username,
            telegram_first_name,
            telegram_photo_url,
          } = parsed.data;
          const scores = await readBoard();
          const existing =
            telegram_id !== undefined ? scores.find((s) => s.tg_id === telegram_id) : undefined;
          // Keep the best score per player: do not add a duplicate lower/equal score.
          if (existing && existing.score >= score) {
            const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 15);
            return new Response(JSON.stringify({ scores: top }), {
              headers: { "Content-Type": "application/json" },
            });
          }
          const filtered =
            telegram_id !== undefined ? scores.filter((s) => s.tg_id !== telegram_id) : scores;
          filtered.push({
            name,
            score,
            date: new Date().toISOString(),
            tg_id: telegram_id,
            tg_username: telegram_username,
            tg_first_name: telegram_first_name,
            tg_photo_url: telegram_photo_url,
          });
          const trimmed = filtered.sort((a, b) => b.score - a.score).slice(0, 15);
          await writeBoard(trimmed);
          const top = trimmed.slice(0, 15);
          return new Response(JSON.stringify({ scores: top }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ scores: [], error: String(e) }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
