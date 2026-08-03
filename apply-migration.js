import postgres from 'postgres';

const sql = postgres(
  'postgresql://postgres:Ars4655789023@db.ueazjqvxjlppgtkhcmut.supabase.co:5432/postgres',
  { ssl: 'require', connect_timeout: 10 },
);

async function main() {
  try {
    const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_active'`;
    console.log('is_active column exists:', res.length > 0);

    if (res.length === 0) {
      console.log('Applying migration...');
      await sql`ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true`;
      await sql`UPDATE public.products SET is_active = true WHERE is_active IS NULL`;
      console.log('Migration applied successfully');
    } else {
      console.log('Column already exists, no action needed');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();