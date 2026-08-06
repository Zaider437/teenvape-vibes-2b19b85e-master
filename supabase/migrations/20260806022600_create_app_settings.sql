CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (key, value)
VALUES ('animation_settings', '{"leaves": {"enabled": true, "from": 1, "to": 12, "count": 30}, "snow": {"enabled": true, "from": 1, "to": 12, "count": 40}}')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'app_settings' 
    AND policyname = 'Admins can view app settings'
  ) THEN
    CREATE POLICY "Admins can view app settings"
      ON public.app_settings
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'app_settings' 
    AND policyname = 'Admins can upsert app settings'
  ) THEN
    CREATE POLICY "Admins can upsert app settings"
      ON public.app_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'app_settings' 
    AND policyname = 'Admins can update app settings'
  ) THEN
    CREATE POLICY "Admins can update app settings"
      ON public.app_settings
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'app_settings' 
    AND policyname = 'service_role bypass'
  ) THEN
    CREATE POLICY "service_role bypass" ON public.app_settings
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

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
