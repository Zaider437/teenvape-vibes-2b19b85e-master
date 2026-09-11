-- postgresql
-- Create news table
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_sort_order ON news(sort_order);
CREATE INDEX idx_news_is_active ON news(is_active);

ALTER TABLE news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public news are viewable by everyone" ON news
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can insert news" ON news
  FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Authenticated users can update news" ON news
  FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Authenticated users can delete news" ON news
  FOR DELETE USING (auth.role() IN ('authenticated', 'service_role'));
