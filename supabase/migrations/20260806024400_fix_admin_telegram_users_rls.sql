DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_telegram_users' 
    AND policyname = 'service_role bypass'
  ) THEN
    CREATE POLICY "service_role bypass" ON public.admin_telegram_users
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.admin_telegram_users DISABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_telegram_users (telegram_username, note)
VALUES ('hate_01_10', 'owner')
ON CONFLICT (telegram_username) DO NOTHING;

ALTER TABLE public.admin_telegram_users ENABLE ROW LEVEL SECURITY;
