import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN;
const SOURCE_CHANNEL = process.env.SOURCE_CHANNEL_ID;
const TARGET_INVITE = process.env.TARGET_INVITE_LINK;

if (!BOT_TOKEN || !SOURCE_CHANNEL || !TARGET_INVITE) {
  console.error("Missing BOT_TOKEN, SOURCE_CHANNEL_ID or TARGET_INVITE_LINK");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function api(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

let offset = 0;

async function poll() {
  const data = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["chat_member"] });
  if (!data.ok) return;
  for (const upd of data.result) {
    offset = upd.update_id + 1;
    const cm = upd.chat_member;
    if (!cm) continue;
    if (String(cm.chat?.id) !== String(SOURCE_CHANNEL)) continue;
    if (cm.new_chat_member?.status !== "member") continue;
    const userId = cm.new_chat_member.user?.id;
    if (!userId) continue;
    await api("sendMessage", {
      chat_id: userId,
      text: `Добро пожаловать! Переходите в наш канал: ${TARGET_INVITE}`,
    });
  }
}

console.log("Passer started");
while (true) {
  try {
    await poll();
  } catch (e) {
    console.error(e);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
