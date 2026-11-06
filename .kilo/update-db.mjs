import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = JSON.parse(
  readFileSync(path.join(__dirname, "..", "product-images", "results.json"), "utf-8"),
);

const SUPABASE_URL = "https://ueazjqvxjlppgtkhcmut.supabase.co";
const SUPABASE_SECRET = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYXpqcXZ4amxwcGd0a2hjbXV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDIwODYyOCwiZXhwIjoyMDk5Nzg0NjI4fQ.00jpKdMnw4YbC6jluVP1mvZDT574kCLHUN1Mrz0JT5o";
const DATABASE_URL =
  "postgresql://postgres:Ars4655789023@db.ueazjqvxjlppgtkhcmut.supabase.co:5432/postgres";

const client = new pg.Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("Connected to database");

  // Build mapping from CDN path to public URL
  const mapping = {};
  for (const r of results) {
    mapping[r.cdnPath] = r.publicUrl;
  }

  // Get all products with __l5e URLs
  const res = await client.query(
    "SELECT id, image_url FROM products WHERE image_url LIKE '/__l5e/%'",
  );
  console.log(`Found ${res.rowCount} products with __l5e URLs`);

  let updated = 0;
  for (const row of res.rows) {
    const newUrl = mapping[row.image_url];
    if (newUrl) {
      await client.query("UPDATE products SET image_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log(`Updated ${row.id}: ${row.image_url} -> ${newUrl}`);
      updated++;
    } else {
      console.log(`No mapping found for ${row.id}: ${row.image_url}`);
    }
  }

  console.log(`\nUpdated ${updated} products`);
  await client.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
