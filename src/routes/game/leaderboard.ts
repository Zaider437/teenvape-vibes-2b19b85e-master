import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const KEY = "game_leaderboard";

type Score = { name: string; score: number; date: string };

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
  return (arr as Score[]).filter((s) => s && typeof s.name === "string" && typeof s.score === "number");
}

async function writeBoard(scores: Score[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key: KEY, value: { scores }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export const Route = createFileRoute("/game/leaderboard")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const scores = await readBoard();
          const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 20);
          return new Response(JSON.stringify({ scores: top }), {
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
          const parsed = z.object({ name: z.string().trim().min(1).max(20), score: z.number().int().nonnegative() }).safeParse(body);
          if (!parsed.success) {
            return new Response(JSON.stringify({ error: "invalid" }), { status: 400, headers: { "Content-Type": "application/json" } });
          }
          const { name, score } = parsed.data;
          const scores = await readBoard();
          scores.push({ name, score, date: new Date().toISOString() });
          const trimmed = scores.sort((a, b) => b.score - a.score).slice(0, 50);
          await writeBoard(trimmed);
          const top = trimmed.slice(0, 20);
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
