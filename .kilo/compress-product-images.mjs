import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = "https://ueazjqvxjlppgtkhcmut.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const BUCKET = "product-images";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "tiff", "bmp"]);

async function listFiles() {
  const allFiles = [];
  let page = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit,
      offset: page * limit,
    });
    if (error) throw error;
    const items = data ?? [];
    allFiles.push(...items);
    if (items.length < limit) break;
    page += 1;
  }

  return allFiles.filter((item) => {
    const ext = (item.name || "").split(".").pop()?.toLowerCase() ?? "";
    return IMAGE_EXTS.has(ext);
  });
}

async function processFile(file) {
  console.log(`Downloading ${file.name} (${(file.metadata?.size ?? "?").toString()})`);

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(file.name);
  if (downloadError) {
    console.error(`  Download failed: ${downloadError.message}`);
    return false;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const originalBuffer = Buffer.from(arrayBuffer);

  try {
    const meta = await sharp(originalBuffer).metadata();
    const shouldResize = (meta.width ?? 0) > 1920 || (meta.height ?? 0) > 1920;

    let pipeline = sharp(originalBuffer);
    if (shouldResize) {
      pipeline = pipeline.resize(1920, 1920, { fit: "inside", withoutEnlargement: true });
    }
    pipeline = pipeline.jpeg({ quality: 75, progressive: true, force: false });

    const compressedBuffer = await pipeline.toBuffer();
    const originalSize = originalBuffer.length;
    const compressedSize = compressedBuffer.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`  Original: ${(originalSize / 1024).toFixed(1)} KB -> Compressed: ${(compressedSize / 1024).toFixed(1)} KB (${ratio}% smaller)`);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(file.name, compressedBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error(`  Upload failed: ${uploadError.message}`);
      return false;
    }

    console.log(`  Uploaded successfully`);
    return true;
  } catch (e) {
    console.error(`  Processing failed: ${e?.message ?? e}`);
    return false;
  }
}

async function main() {
  console.log("Listing files in product-images bucket...");
  const files = await listFiles();
  console.log(`Found ${files.length} image(s)`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const ok = await processFile(file);
    if (ok) success += 1;
    else failed += 1;
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
