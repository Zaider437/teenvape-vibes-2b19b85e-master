import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_API_KEY || "";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

async function tgApi(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function downloadFile(fileId: string): Promise<ArrayBuffer | null> {
  const info = await tgApi("getFile", { file_id: fileId });
  if (!info.ok) return null;
  const filePath = info.result.file_path;
  const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  if (!res.ok) return null;
  return res.arrayBuffer();
}

async function transcribe(buffer: ArrayBuffer): Promise<string> {
  if (!OPENAI_API_KEY) return "";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "audio/ogg" }), "voice.ogg");
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  const json = await res.json();
  return json.text || "";
}

async function getMeetingTimes(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin
    .from("admin_telegram_users" as any)
    .select("note")
    .eq("telegram_username", "__meeting_times__")
    .maybeSingle() as any);
  if (data?.note) {
    try {
      return JSON.parse(data.note);
    } catch {
      return [];
    }
  }
  return [];
}

async function saveMeetingTimes(times: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await (supabaseAdmin
    .from("admin_telegram_users" as any)
    .select("id")
    .eq("telegram_username", "__meeting_times__")
    .maybeSingle() as any);
  if (existing) {
    await supabaseAdmin
      .from("admin_telegram_users" as any)
      .update({ note: JSON.stringify(times) })
      .eq("telegram_username", "__meeting_times__");
  } else {
    await supabaseAdmin.from("admin_telegram_users" as any).insert({
      telegram_username: "__meeting_times__",
      note: JSON.stringify(times),
    });
  }
}

function parseIntent(text: string): { action: "add" | "remove"; time: string } | null {
  const removeMatch = text.match(/убери\s+(\d{1,2}:\d{2})/i);
  if (removeMatch) return { action: "remove", time: removeMatch[1] };
  const addMatch = text.match(/добавь\s+(\d{1,2}:\d{2})/i);
  if (addMatch) return { action: "add", time: addMatch[1] };
  return null;
}

export const Route = createFileRoute("/api/telegram-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) {
          return new Response("Forbidden", { status: 403 });
        }

        const update = await request.json();
        const message = update?.message;
        if (!message) return new Response("OK");

        const chatId = message.chat?.id;
        if (ADMIN_CHAT_ID && String(chatId) !== String(ADMIN_CHAT_ID)) {
          await tgApi("sendMessage", { chat_id: chatId, text: "Доступ запрещён" });
          return new Response("OK");
        }

        let text = message.text || "";

        if (message.voice || message.audio) {
          const fileId = (message.voice || message.audio).file_id;
          const buffer = await downloadFile(fileId);
          if (buffer) {
            text = await transcribe(buffer);
          }
          if (!text) {
            await tgApi("sendMessage", {
              chat_id: chatId,
              text: "Не удалось распознать голос. Отправьте текстом: «убери 15:00» или «добавь 15:00».",
            });
            return new Response("OK");
          }
        }

        const intent = parseIntent(text);
        if (!intent) {
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: `Распознано: «${text}». Команды: «убери HH:MM» или «добавь HH:MM».`,
          });
          return new Response("OK");
        }

        const times = await getMeetingTimes();
        if (intent.action === "remove") {
          const filtered = times.filter((t) => t !== intent.time);
          await saveMeetingTimes(filtered);
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: `Удалено ${intent.time}. Осталось: ${filtered.join(", ")}`,
          });
        } else {
          if (!times.includes(intent.time)) times.push(intent.time);
          await saveMeetingTimes(times);
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: `Добавлено ${intent.time}. Теперь: ${times.join(", ")}`,
          });
        }

        return new Response("OK");
      },
    },
  },
});
