CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upsert app settings"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app settings"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

CREATE OR REPLACE FUNCTION public.update_animation_settings(_settings jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.app_settings (key, value)
  VALUES ('animation_settings', _settings)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
$$;

REVOKE EXECUTE ON FUNCTION public.update_animation_settings(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_animation_settings(jsonb) TO service_role;

CREATE POLICY IF NOT EXISTS "service_role bypass" ON public.app_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.app_settings (key, value)
VALUES ('animation_settings', '{"leaves": {"enabled": true, "from": 1, "to": 12, "count": 30}, "snow": {"enabled": true, "from": 1, "to": 12, "count": 40}}')
ON CONFLICT (key) DO NOTHING;
