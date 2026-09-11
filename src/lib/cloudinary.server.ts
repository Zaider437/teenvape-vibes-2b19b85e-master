import { createHash } from "node:crypto";

function getEnv(name: string): string | undefined {
  return (
    (globalThis as any).env?.[name] ||
    (globalThis as any).__env__?.[name] ||
    process.env[name]
  );
}

function getCloudinaryConfig() {
  const cloudName = getEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = getEnv("CLOUDINARY_API_KEY");
  const apiSecret = getEnv("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary не настроен. Укажите CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY и CLOUDINARY_API_SECRET.",
    );
  }
  return { cloudName, apiKey, apiSecret };
}

function sign(params: Record<string, string>, apiSecret: string): string {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== "" && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

export async function uploadCloudinaryImage(file: File) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = crypto.randomUUID();
  const folder = "products";
  const signature = sign({ folder, public_id: publicId, timestamp }, apiSecret);
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", apiKey);
  body.append("timestamp", timestamp);
  body.append("folder", folder);
  body.append("public_id", publicId);
  body.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  const result = (await response.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(`Ошибка загрузки в Cloudinary: ${result.error?.message || response.statusText}`);
  }
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign({ public_id: publicId, timestamp }, apiSecret);
  const body = new URLSearchParams({ public_id: publicId, api_key: apiKey, timestamp, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = (await response.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (!response.ok || (result.result !== "ok" && result.result !== "not found")) {
    throw new Error(`Ошибка удаления из Cloudinary: ${result.error?.message || response.statusText}`);
  }
}

export function getCloudinaryPublicId(url: string | null | undefined): string | null {
  if (!url || !url.includes("res.cloudinary.com/")) return null;
  try {
    const pathname = new URL(url).pathname;
    const uploadMarker = "/upload/";
    const markerIndex = pathname.indexOf(uploadMarker);
    if (markerIndex < 0) return null;
    const parts = pathname.slice(markerIndex + uploadMarker.length).split("/");
    const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
    const publicParts = (versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts).filter(Boolean);
    if (publicParts.length === 0) return null;
    const last = publicParts.length - 1;
    publicParts[last] = publicParts[last].replace(/\.[^/.]+$/, "");
    return publicParts.join("/");
  } catch {
    return null;
  }
}
