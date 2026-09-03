-- Create manufacturers table
CREATE TABLE IF NOT EXISTS manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_sort JSONB
);

-- Add manufacturer_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_manufacturer_id ON products(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_slug ON manufacturers(slug);
CREATE INDEX IF NOT EXISTS idx_manufacturers_sort_order ON manufacturers(sort_order);

-- Enable RLS
ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;

-- Public read access to active manufacturers
CREATE POLICY "Public manufacturers are viewable by everyone" ON manufacturers
  FOR SELECT USING (is_active = true);

-- Service role / authenticated admin can manage manufacturers
CREATE POLICY "Authenticated users can insert manufacturers" ON manufacturers
  FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Authenticated users can update manufacturers" ON manufacturers
  FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Authenticated users can delete manufacturers" ON manufacturers
  FOR DELETE USING (auth.role() IN ('authenticated', 'service_role'));
