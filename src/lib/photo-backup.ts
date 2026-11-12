/**
 * Бэкап фото товаров на Cloudflare Workers.
 *
 * Что делает runPhotoBackup:
 * 1. Читает все товары из Supabase (id, slug, name, brand, image_url, is_active).
 * 2. Собирает "пул" всех когда-либо виденных ссылок из журнала product_activity_log
 *    (снапшоты, детали, oldValue/newValue) — независимый источник ссылок.
 * 3. Проверяет живость каждой ссылки дешёвым HEAD-запросом.
 * 4. Складывает полный дамп { products, aliveUrls, generatedAt } в app_settings
 *    (ключ photo_backup_latest) — это снимок на случай массовых пропаж.
 * 5. Автопочинка: товарам с битой ссылкой подставляет живую ссылку из пула
 *    (точное совпадение по имени файла; иначе — живая ссылка того же бренда).
 *
 * Окружение: Cloudflare Workers (nodejs_compat). fetch — глобальный.
 */

const BACKUP_KEY = "photo_backup_latest";
const BACKUP_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000; // не чаще раза в 20 часов

type ProductLite = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  is_active: boolean;
};

function envVar(env: any, name: string): string | undefined {
  return env?.[name] || (globalThis as any).env?.[name] || (globalThis as any).__env__?.[name];
}

function serviceHeaders(env: any): Record<string, string> {
  const url = envVar(env, "SUPABASE_URL") || envVar(env, "VITE_SUPABASE_URL") || "";
  const key =
    envVar(env, "SUPABASE_SECRET_KEY") ||
    envVar(env, "SUPABASE_SERVICE_ROLE_KEY") ||
    envVar(env, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
    "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    SupabaseBase: url,
  };
}

async function supabaseFetch(
  env: any,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  const url = envVar(env, "SUPABASE_URL") || envVar(env, "VITE_SUPABASE_URL") || "";
  const key =
    envVar(env, "SUPABASE_SECRET_KEY") ||
    envVar(env, "SUPABASE_SERVICE_ROLE_KEY") ||
    envVar(env, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
    "";
  const res = await fetch(`${url}${path}`, {
    method: init?.method ?? "GET",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return res;
}

function fileKey(url: string): string {
  return (url.split("?")[0].split("/").pop() || url).toLowerCase();
}

function toAbsolute(env: any, url: string): string | null {
  if (url.startsWith("http")) return url;
  if (url.startsWith("/assets/") || url.startsWith("/__l5e/")) return null; // локальные — всегда ок
  const base = envVar(env, "SUPABASE_URL") || envVar(env, "VITE_SUPABASE_URL") || "";
  if (base && url.startsWith("/")) return `${base}${url}`;
  return null;
}

async function isAlive(env: any, url: string): Promise<boolean> {
  const abs = toAbsolute(env, url);
  if (!abs) return true; // локальные считаем живыми
  try {
    const res = await fetch(abs, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchProducts(env: any): Promise<ProductLite[]> {
  const res = await supabaseFetch(
    env,
    `/rest/v1/products?select=id,slug,name,brand,image_url,is_active&limit=5000`,
  );
  if (!res.ok) throw new Error(`products fetch failed: ${res.status}`);
  return (await res.json()) as ProductLite[];
}

async function collectHistoryUrls(env: any): Promise<Map<string, string>> {
  const res = await supabaseFetch(
    env,
    `/rest/v1/product_activity_log?select=details,product_snapshot&order=created_at.desc&limit=2000`,
  );
  const logs = res.ok ? ((await res.json()) as any[]) : [];
  const pool = new Map<string, string>(); // url -> name
  const add = (u: unknown, name: unknown) => {
    if (typeof u === "string" && u && !pool.has(u)) {
      pool.set(u, typeof name === "string" ? name : "");
    }
  };
  for (const l of logs) {
    const snap = l.product_snapshot;
    const det = l.details;
    add(snap?.image_url, snap?.name);
    add(det?.image_url, det?.name);
    if (Array.isArray(det?.changes)) {
      for (const c of det.changes) {
        if (c?.field === "image_url") {
          add(c.oldValue, det?.name);
          add(c.newValue, det?.name);
        }
      }
    }
  }
  return pool;
}

export type PhotoBackupResult = {
  products: number;
  alivePool: number;
  deadCurrent: number;
  repaired: number;
  repairedDetails: { id: string; name: string; from: string; to: string }[];
  savedAt: string;
  trigger: "cron" | "startup";
};

export async function runPhotoBackup(
  env: any,
  trigger: "cron" | "startup" = "cron",
): Promise<PhotoBackupResult> {
  const products = await fetchProducts(env);

  // Пул живых ссылок: история + текущие ссылки товаров
  const history = await collectHistoryUrls(env);
  const aliveByName = new Map<string, { url: string; name: string }[]>();
  const addAlive = async (url: string, name: string) => {
    if (!url || url.startsWith("/assets/") || url.startsWith("/__l5e/")) return;
    if (await isAlive(env, url)) {
      const key = fileKey(url);
      const list = aliveByName.get(key) ?? [];
      if (!list.some((x) => x.url === url)) list.push({ url, name });
      aliveByName.set(key, list);
    }
  };
  for (const [url, name] of history) await addAlive(url, name);
  for (const p of products) if (p.image_url) await addAlive(p.image_url, p.name);

  // Живость текущих ссылок + автопочинка
  const repairedDetails: PhotoBackupResult["repairedDetails"] = [];
  const patchOps: { id: string; image_url: string }[] = [];
  for (const p of products) {
    const cur = p.image_url;
    if (!cur || cur.startsWith("/assets/") || cur.startsWith("/__l5e/")) continue;
    if (await isAlive(env, cur)) continue;

    // Кандидат 1: тот же файл под другой живой ссылкой
    const same = aliveByName.get(fileKey(cur)) ?? [];
    let candidate = same[0]?.url;

    // Кандидат 2: живая ссылка другого товара того же бренда (брендовая обложка)
    if (!candidate) {
      const brand = (p.brand || "").toLowerCase();
      if (brand) {
        const sameBrand = products.find(
          (q) =>
            q.id !== p.id &&
            (q.brand || "").toLowerCase() === brand &&
            q.image_url &&
            !q.image_url.startsWith("/assets/") &&
            aliveByName.get(fileKey(q.image_url)),
        );
        if (sameBrand?.image_url) candidate = sameBrand.image_url;
      }
    }

    if (candidate && candidate !== cur) {
      patchOps.push({ id: p.id, image_url: candidate });
      repairedDetails.push({ id: p.id, name: p.name, from: cur, to: candidate });
    }
  }

  // Применяем починку
  for (const op of patchOps) {
    const res = await supabaseFetch(env, `/rest/v1/products?id=eq.${op.id}`, {
      method: "PATCH",
      body: { image_url: op.image_url },
    });
    if (!res.ok && res.status !== 204) {
      console.error("[photo-backup] patch failed", op.id, res.status);
    }
  }

  // Полный дамп в app_settings (независимый «бэкап ссылок»)
  const dump = {
    generatedAt: new Date().toISOString(),
    trigger,
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      image_url: p.image_url,
      is_active: p.is_active,
    })),
    alivePool: Array.from(aliveByName.entries()).map(([key, list]) => ({ key, urls: list.map((l) => l.url) })),
  };
  const upsert = await supabaseFetch(env, `/rest/v1/app_settings`, {
    method: "POST",
    body: { key: BACKUP_KEY, value: dump },
  });
  // 409 = уже существует → делаем upsert через PATCH
  if (upsert.status === 409) {
    await supabaseFetch(env, `/rest/v1/app_settings?key=eq.${BACKUP_KEY}`, {
      method: "PATCH",
      body: { value: dump },
    });
  } else if (!upsert.ok && upsert.status !== 201 && upsert.status !== 204) {
    console.error("[photo-backup] dump save failed", upsert.status, await upsert.text());
  }

  return {
    products: products.length,
    alivePool: aliveByName.size,
    deadCurrent: repairedDetails.length,
    repaired: repairedDetails.length,
    repairedDetails: repairedDetails.slice(0, 20),
    savedAt: dump.generatedAt,
    trigger,
  };
}

/**
 * Запуск «при деплое»: проверяет давность последнего дампа и запускает бэкап,
 * только если он был раньше, чем BACKUP_MIN_INTERVAL_MS назад.
 */
export async function runPhotoBackupIfNeeded(env: any): Promise<PhotoBackupResult | null> {
  const res = await supabaseFetch(env, `/rest/v1/app_settings?key=eq.${BACKUP_KEY}&select=value`);
  if (res.ok) {
    const rows = (await res.json()) as any[];
    const last = rows?.[0]?.value?.generatedAt;
    if (last && Date.now() - new Date(last).getTime() < BACKUP_MIN_INTERVAL_MS) {
      return null; // свежий дамп уже есть
    }
  }
  return runPhotoBackup(env, "startup");
}
