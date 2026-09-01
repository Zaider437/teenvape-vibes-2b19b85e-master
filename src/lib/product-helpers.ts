const PUBLIC_IMAGE_CDN_BASE =
  (globalThis as any).env?.PUBLIC_IMAGE_CDN_BASE ||
  (globalThis as any).__env__?.PUBLIC_IMAGE_CDN_BASE ||
  "https://ueazjqvxjlppgtkhcmut.supabase.co/storage/v1/object/public/product-images";

const signedUrlCache = new Map<string, { url: string; expires: number }>();

export function formatImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/assets/") || url.startsWith("/__l5e/")) return url;
  const fileName = url.split("/").pop() || url.replace(/^\//, "");
  // Supabase storage does NOT support ?width/quality/format transform params on
  // the /object/public/ endpoint (they return HTTP 400 -> CORB errors), so we
  // must use the plain public object URL.
  return `${PUBLIC_IMAGE_CDN_BASE}/${encodeURIComponent(fileName || "")}`;
}

export async function getSignedImageUrl(
  url: string | null | undefined,
  expiresIn: number = 3600,
): Promise<string | null> {
  if (!url || typeof window !== "undefined") return url;

  const SUPABASE_URL =
    (globalThis as any).env?.SUPABASE_URL ||
    (globalThis as any).__env__?.SUPABASE_URL ||
    "https://ueazjqvxjlppgtkhcmut.supabase.co";
  const BUCKET = "product-images";

  if (url.startsWith("http")) {
    if (url.includes(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`)) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filePath = pathname.replace(`/storage/v1/object/public/${BUCKET}/`, "");
        const cached = signedUrlCache.get(filePath);
        if (cached && cached.expires > Date.now()) {
          return cached.url;
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(filePath, expiresIn);
        const signedUrl = data?.signedUrl || formatImageUrl(url) || null;
        if (signedUrl) {
          signedUrlCache.set(filePath, {
            url: signedUrl,
            expires: Date.now() + (expiresIn - 60000) * 1000,
          });
        }
        return signedUrl;
      } catch (e) {
        console.warn("[getSignedImageUrl] failed for http url, fallback to public CDN", url, e);
        return formatImageUrl(url) || null;
      }
    }
    return url;
  }

  if (url.startsWith("/assets/")) return url;

  let filePath = url;
  if (url.startsWith("/__l5e/")) {
    filePath = url.split("/").pop() || "";
  } else if (url.startsWith(`${BUCKET}/`)) {
    filePath = url.split("/").pop() || "";
  } else {
    filePath = url.split("/").pop() || url.replace(/^\//, "");
  }

  if (!filePath) {
    return formatImageUrl(url) || null;
  }

  const cached = signedUrlCache.get(filePath);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(filePath, expiresIn);
    const signedUrl = data?.signedUrl || formatImageUrl(url) || null;
    if (signedUrl) {
      signedUrlCache.set(filePath, {
        url: signedUrl,
        expires: Date.now() + (expiresIn - 60000) * 1000,
      });
    }
    return signedUrl;
  } catch (e) {
    console.warn("[getSignedImageUrl] createSignedUrl failed for", filePath, e);
    return formatImageUrl(url) || null;
  }
}

export function buildDescription(p: {
  category?: string | null;
  brand?: string | null;
  flavor?: string | null;
  puffs?: string | null;
  volume?: string | null;
  description?: string | null;
}): string {
  if (p.description && p.description.trim()) return p.description.trim();
  const brand = p.brand || "";
  const lines: string[] = [];
  if (p.category === "disposable") {
    lines.push(`Одноразовая POD-система ${brand}.`);
    if (p.flavor) lines.push(`Вкус: ${p.flavor}`);
    if (p.puffs) lines.push(p.puffs);
    lines.push(p.volume ? `Объём жидкости: ${p.volume}` : "Объём жидкости: 12–18 мл");
    lines.push("Ёмкость аккумулятора: 500–650 mAh");
    lines.push("Сетчатый испаритель (mesh) для насыщенного вкуса");
  } else if (p.category === "liquid") {
    lines.push(`Жидкость для POD-систем ${brand}.`);
    if (p.flavor) lines.push(`Вкус: ${p.flavor}`);
    lines.push(p.volume ? `Объём / крепость: ${p.volume}` : "Объём: 30 мл · крепость 20 мг");
    lines.push("Соотношение PG/VG: 50/50 — для солевых никотинов");
    lines.push("Подходит для маломощных POD-устройств");
  } else if (p.category === "device") {
    lines.push(`POD-устройство ${brand}.`);
    if (p.flavor) lines.push(`Цвет: ${p.flavor}`);
    lines.push("Ёмкость аккумулятора: до 1000–2000 mAh");
    lines.push("Объём картриджа: 2–4 мл");
    lines.push("Регулировка затяжки и мощности");
  } else if (p.category === "consumable") {
    lines.push(`Расходник для ${brand}.`);
    if (p.flavor) lines.push(p.flavor);
    if (p.volume) lines.push(p.volume);
  } else {
    if (brand) lines.push(brand);
    if (p.flavor) lines.push(p.flavor);
  }
  return lines.filter(Boolean).join("\n");
}
