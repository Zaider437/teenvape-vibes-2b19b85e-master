import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://ueazjqvxjlppgtkhcmut.supabase.co";
const SUPABASE_SECRET = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYXpqcXZ4amxwcGd0a2hjbXV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDIwODYyOCwiZXhwIjoyMDk5Nzg0NjI4fQ.00jpKdMnw4YbC6jluVP1mvZDT574kCLHUN1Mrz0JT5o";
const BUCKET = "product-images";

const outDir = path.join(__dirname, "..", "product-images");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(urlObj, options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString() }),
      );
      res.on("error", reject);
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function uploadToSupabase(fileBuffer, fileName) {
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(fileName)}`;

  const result = await httpsRequest(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${SUPABASE_SECRET}`,
      apikey: SUPABASE_SECRET,
    },
    body: fileBuffer,
  });

  if (result.status >= 200 && result.status < 300) {
    return fileName;
  } else if (result.status === 409 || result.body.includes('"Duplicate"') || result.body.includes("already exists")) {
    console.log(`⊘ Already exists: ${fileName}`);
    return fileName;
  } else {
    console.error(`✗ Failed to upload ${fileName}: ${result.status} ${result.body}`);
    return null;
  }
}

async function makeBucketPrivate() {
  const url = `${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`;
  const result = await httpsRequest(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${SUPABASE_SECRET}`,
      apikey: SUPABASE_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });

  if (result.status === 200 || result.status === 201 || result.status === 204) {
    console.log("✓ Bucket made private");
    return true;
  } else {
    console.error(`✗ Failed to make bucket private: ${result.status} ${result.body}`);
    return false;
  }
}

async function main() {
  const results = [];

  // Query all products with images
  const queryUrl = `${SUPABASE_URL}/rest/v1/products?select=id,name,image_url&image_url=not.is.null`;
  
  const productsRes = await httpsRequest(queryUrl, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SECRET,
      Authorization: `Bearer ${SUPABASE_SECRET}`,
      "Content-Type": "application/json",
    },
  });

  if (productsRes.status !== 200) {
    console.error("Failed to fetch products:", productsRes.body);
    process.exit(1);
  }

  const products = JSON.parse(productsRes.body);
  console.log(`Found ${products.length} products with images`);

  for (const product of products) {
    if (!product.image_url) continue;

    let newPath = null;

    // Check if it's already a Supabase Storage public URL
    if (product.image_url.includes(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`)) {
      const urlObj = new URL(product.image_url);
      const pathname = urlObj.pathname;
      newPath = pathname.replace(`/storage/v1/object/public/${BUCKET}/`, "");
      console.log(`⊘ Already in Supabase Storage: ${product.name} -> ${newPath}`);
      results.push({ id: product.id, name: product.name, path: newPath, status: "unchanged" });
      continue;
    }

    // Check if it's already in the new format (just a path)
    if (!product.image_url.startsWith("http") && !product.image_url.startsWith("/assets/")) {
      newPath = product.image_url;
      console.log(`⊘ Already a path: ${product.name} -> ${newPath}`);
      results.push({ id: product.id, name: product.name, path: newPath, status: "unchanged" });
      continue;
    }

    // External URL - needs migration
    if (product.image_url.startsWith("http")) {
      console.log(`↓ Downloading: ${product.name} from ${product.image_url}`);
      
      try {
        const imageBuffer = await httpsGet(product.image_url);
        
        // Generate new filename
        const ext = path.extname(new URL(product.image_url).pathname) || ".jpg";
        const fileName = `${crypto.randomUUID()}${ext}`;
        
        const uploadedPath = await uploadToSupabase(imageBuffer, fileName);
        
        if (uploadedPath) {
          newPath = uploadedPath;
          
          // Update product with new path
          const updateUrl = `${SUPABASE_URL}/rest/v1/products?id=eq.${product.id}`;
          const updateRes = await httpsRequest(updateUrl, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_SECRET,
              Authorization: `Bearer ${SUPABASE_SECRET}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ image_url: newPath }),
          });

          if (updateRes.status === 200 || updateRes.status === 204) {
            console.log(`✓ Updated: ${product.name} -> ${newPath}`);
            results.push({ id: product.id, name: product.name, path: newPath, status: "migrated" });
          } else {
            console.error(`✗ Failed to update ${product.name}: ${updateRes.status} ${updateRes.body}`);
            results.push({ id: product.id, name: product.name, path: product.image_url, status: "error" });
          }
        }
      } catch (e) {
        console.error(`✗ Error processing ${product.name}:`, e.message);
        results.push({ id: product.id, name: product.name, path: product.image_url, status: "error" });
      }
    }
  }

  // Save results
  const resultsPath = path.join(outDir, "migration-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nMigration complete. Results saved to ${resultsPath}`);
  
  const migrated = results.filter(r => r.status === "migrated").length;
  const unchanged = results.filter(r => r.status === "unchanged").length;
  const errors = results.filter(r => r.status === "error").length;
  console.log(`Summary: ${migrated} migrated, ${unchanged} unchanged, ${errors} errors`);

  // Make bucket private
  console.log("\nMaking bucket private...");
  const success = await makeBucketPrivate();
  if (success) {
    console.log("✓ Bucket is now private. Images will be served via signed URLs.");
  } else {
    console.log("⚠ Could not make bucket private. Run manually:");
    console.log(`   ${SUPABASE_URL}/storage/v1/bucket/${BUCKET} with { public: false }`);
  }
}

main().catch(console.error);
