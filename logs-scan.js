const supabaseUrl = "https://ueazjqvxjlppgtkhcmut.supabase.co";
const serviceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYXpqcXZ4amxwcGd0a2hjbXV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDIwODYyOCwiZXhwIjoyMDk5Nzg0NjI4fQ.00jpKdMnw4YbC6jluVP1mvZDT574kCLHUN1Mrz0JT5o";
const H = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

const logs = await fetch(
  `${supabaseUrl}/rest/v1/product_activity_log?select=product_id,action,details,product_snapshot,created_at&order=created_at.desc&limit=2000`,
  { headers: H },
).then((r) => r.json());

const prods = await fetch(`${supabaseUrl}/rest/v1/products?select=id,slug,name,image_url,is_active&limit=2000`, { headers: H }).then((r) => r.json());
const byId = new Map(prods.map((p) => [p.id, p]));

console.log("сравнение снапшота vs текущее состояние:\n");
let diffs = 0;
for (const l of logs || []) {
  const snap = l.product_snapshot;
  if (!snap) continue;
  const cur = byId.get(l.product_id);
  const oldImg = snap.image_url || null;
  const curImg = cur?.image_url || null;
  if (oldImg !== curImg) {
    diffs++;
    console.log(`[${l.created_at.slice(0, 16)}][${l.action}] ${snap.name || cur?.name}`);
    console.log(`   снапшот: ${oldImg ? oldImg.slice(-62) : "(нет)"}`);
    console.log(`   сейчас : ${curImg ? curImg.slice(-62) : "(нет)"}`);
    console.log(`   товар ${cur ? (cur.is_active === false ? "выкл" : "вкл") : "УДАЛЁН"}\n`);
  }
}
console.log("расхождений:", diffs);
