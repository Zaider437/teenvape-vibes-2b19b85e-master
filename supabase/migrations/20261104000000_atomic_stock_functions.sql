-- NOTE: This is PostgreSQL (Supabase) syntax. VS Code may highlight it with the
-- mssql extension and show false "Incorrect syntax" errors for CREATE OR REPLACE
-- FUNCTION / $$ dollar-quoting. Enable this file-only setting to silence them:
--   { "mssql.lint.enableSqlFlaws": false }
-- (or set files.associations so .sql in supabase/ uses the postgres extension).

-- Atomic stock operations to prevent lost updates.
--
-- Previously createOrder wrote an absolute value (stock_quantity - qty) that was
-- computed from a value read earlier, so two concurrent orders could both read
-- the same stock and one decrement was silently lost. cancelOrder had the same
-- problem when restoring stock. These functions perform the read-modify-write
-- inside a single SQL statement (atomic per row).
CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_product_id uuid, p_qty integer) RETURNS void LANGUAGE sql AS $$
UPDATE public.products
SET stock_quantity = GREATEST(0, stock_quantity - GREATEST(p_qty, 0)),
  is_active = CASE
    WHEN GREATEST(0, stock_quantity - GREATEST(p_qty, 0)) = 0 THEN false
    ELSE is_active
  END
WHERE id = p_product_id;
$$;
CREATE OR REPLACE FUNCTION public.restore_product_stock(p_product_id uuid, p_qty integer) RETURNS void LANGUAGE sql AS $$
UPDATE public.products
SET stock_quantity = stock_quantity + GREATEST(p_qty, 0),
  is_active = true
WHERE id = p_product_id;
$$;