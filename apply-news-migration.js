import postgres from "postgres";

const sql = postgres(
  "postgresql://postgres:Ars4655789023@db.ueazjqvxjlppgtkhcmut.supabase.co:5432/postgres",
  { ssl: "require", connect_timeout: 10 },
);

async function main() {
  try {
    const res = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'news' AND column_name = 'id'
    `;
    console.log("news table exists:", res.length > 0);

    if (res.length === 0) {
      console.log("Applying news migration...");
      await sql`
        CREATE TABLE IF NOT EXISTS news (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          text TEXT NOT NULL,
          image_url TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_news_sort_order ON news(sort_order)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_news_is_active ON news(is_active)
      `;
      await sql`
        ALTER TABLE news ENABLE ROW LEVEL SECURITY
      `;
      await sql`
        CREATE POLICY "Public news are viewable by everyone" ON news
          FOR SELECT USING (is_active = true)
      `;
      await sql`
        CREATE POLICY "Authenticated users can insert news" ON news
          FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'))
      `;
      await sql`
        CREATE POLICY "Authenticated users can update news" ON news
          FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'))
      `;
      await sql`
        CREATE POLICY "Authenticated users can delete news" ON news
          FOR DELETE USING (auth.role() IN ('authenticated', 'service_role'))
      `;
      console.log("News migration applied successfully");
    } else {
      console.log("news table already exists, no action needed");
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
