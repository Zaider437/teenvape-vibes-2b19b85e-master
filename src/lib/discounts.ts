import { createServerFn } from "@tanstack/react-start";

// Скидки хранятся одной строкой в app_settings: { "<product_id>": <цена со скидкой> }
export const PRODUCT_DISCOUNTS_KEY = "product_discounts";

export type DiscountMap = Record<string, number>;

export function normalizeDiscountMap(value: unknown): DiscountMap {
  const out: DiscountMap = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [id, price] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof price === "number" ? price : Number(price);
    if (Number.isFinite(n) && n > 0) out[id] = n;
  }
  return out;
}

export type EffectivePrice = {
  price: number;
  oldPrice: number | null;
  discountPercent: number | null;
};

export function getEffectivePrice(
  price: number,
  discountPrice: number | null | undefined,
): EffectivePrice {
  const base = Number.isFinite(price) ? price : 0;
  const d = discountPrice == null ? NaN : Number(discountPrice);
  if (!Number.isFinite(d) || d <= 0 || base <= 0 || d >= base) {
    return { price: base, oldPrice: null, discountPercent: null };
  }
  return {
    price: d,
    oldPrice: base,
    discountPercent: Math.round((1 - d / base) * 100),
  };
}

export function applyDiscounts<T extends { id: string; price: number }>(
  products: T[],
  discounts: DiscountMap,
): (T & { old_price: number | null; discount_percent: number | null })[] {
  return products.map((p) => {
    const eff = getEffectivePrice(p.price, discounts[p.id]);
    return {
      ...p,
      price: eff.price,
      old_price: eff.oldPrice,
      discount_percent: eff.discountPercent,
    };
  });
}

let cachedMap: DiscountMap | null = null;
let cachedMapExpiry = 0;

export function invalidateDiscountsCache() {
  cachedMap = null;
  cachedMapExpiry = 0;
}

/** Чтение карты скидок (только на сервере, через клиент с service role). */
export async function readProductDiscounts(): Promise<DiscountMap> {
  const now = Date.now();
  if (cachedMap && cachedMapExpiry > now) return cachedMap;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin
      .from("app_settings" as any)
      .select("value")
      .eq("key", PRODUCT_DISCOUNTS_KEY)
      .maybeSingle() as any);
    if (!error && data?.value) {
      cachedMap = normalizeDiscountMap(data.value);
      cachedMapExpiry = Date.now() + 30 * 1000;
      return cachedMap;
    }
    if (error) throw error;
  } catch (e) {
    console.warn("[discounts] read failed, no discounts applied", e);
  }

  cachedMap = {};
  cachedMapExpiry = Date.now() + 10 * 1000;
  return cachedMap;
}

/** Публичное чтение карты скидок для витрины (в т.ч. из клиентского кода). */
export const getProductDiscounts = createServerFn({ method: "GET" }).handler(async () => {
  return await readProductDiscounts();
});
