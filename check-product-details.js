import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ueazjqvxjlppgtkhcmut.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYXpqcXZ4amxwcGd0a2hjbXV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDIwODYyOCwiZXhwIjoyMDk5Nzg0NjI4fQ.00jpKdMnw4YbC6jluVP1mvZDT574kCLHUN1Mrz0JT5o";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: products, error } = await supabase
    .from("products")
    .select("name, slug, brand, category, price")
    .eq("category", "liquid")
    .limit(50);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log("Sample liquids details:");
  for (const p of products) {
    console.log(`Name: ${p.name} | Slug: ${p.slug} | Brand: ${p.brand} | Price: ${p.price}`);
  }
}

run();
