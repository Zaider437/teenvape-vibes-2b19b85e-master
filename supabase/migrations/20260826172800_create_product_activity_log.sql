CREATE TABLE IF NOT EXISTS public.product_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  product_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_activity_log_product_id ON public.product_activity_log (product_id);
CREATE INDEX IF NOT EXISTS idx_product_activity_log_created_at ON public.product_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_activity_log_action ON public.product_activity_log (action);
