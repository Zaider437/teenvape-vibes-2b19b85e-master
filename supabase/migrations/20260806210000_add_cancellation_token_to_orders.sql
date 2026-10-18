ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_token text UNIQUE;
