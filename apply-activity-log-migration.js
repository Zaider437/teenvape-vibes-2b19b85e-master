import postgres from 'postgres';

const connectionString = 'postgresql://postgres:Ars4655789023@db.ueazjqvxjlppgtkhcmut.supabase.co:5432/postgres';
const sql = postgres(connectionString, { ssl: 'require', connect_timeout: 10 });

async function main() {
  try {
    const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_activity_log'`;
    console.log('Table exists:', res.length > 0);

    if (res.length === 0) {
      console.log('Applying migration...');
      await sql`
        CREATE TABLE public.product_activity_log (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id uuid,
          action text NOT NULL,
          details jsonb NOT NULL DEFAULT '{}'::jsonb,
          product_snapshot jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX idx_product_activity_log_product_id ON public.product_activity_log (product_id)`;
      await sql`CREATE INDEX idx_product_activity_log_created_at ON public.product_activity_log (created_at DESC)`;
      await sql`CREATE INDEX idx_product_activity_log_action ON public.product_activity_log (action)`;
      console.log('Migration applied successfully');
    } else {
      console.log('Table already exists, no action needed');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
