import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const adminCache = new Map<string, { expires: number }>();

async function assertAdmin(context: { supabase: any; userId: string }) {
  const now = Date.now();
  const cached = adminCache.get(context.userId);
  if (cached && cached.expires > now) {
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let isAuthorized = false;

  try {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!error && data) {
      isAuthorized = true;
    }
  } catch (e) {
    console.warn("[assertAdmin] Direct role check failed", e);
  }

  if (!isAuthorized) {
    try {
      const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
        context.userId,
      );
      if (!userErr && userRes?.user) {
        const username = userRes.user.user_metadata?.telegram_username;
        if (username) {
          const { data: allowed, error: whitelistErr } = await supabaseAdmin.rpc(
            "is_admin_telegram_username",
            { _username: username },
          );
          if (!whitelistErr && allowed) {
            console.log(
              `[assertAdmin] Bypassed role check for whitelisted Telegram user: @${username}`,
            );
            isAuthorized = true;
          }
        }
      }
    } catch (e) {
      console.warn("[assertAdmin] Telegram whitelist fallback failed", e);
    }
  }

  if (isAuthorized) {
    adminCache.set(context.userId, { expires: now + 10 * 60 * 1000 });
    return;
  }

  throw new Error("Нет прав администратора");
}

const productSchema = z.object({
  id: z.string().optional().nullable(),
  slug: z.string().trim().min(1).max(1000),
  name: z.string().trim().min(1).max(1000),
  brand: z.string().trim().min(1).max(1000),
  category: z.string().trim().min(1).max(1000),
  subcategory: z.string().trim().max(1000).optional().nullable(),
  price: z.number().nonnegative(),
  flavor: z.string().trim().max(1000).optional().nullable(),
  puffs: z.string().trim().max(1000).optional().nullable(),
  volume: z.string().trim().max(1000).optional().nullable(),
  emoji: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(100),
  image_url: z.string().trim().max(2000).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
  stock_quantity: z.number().int().nonnegative(),
});

type ProductField =
  | "slug"
  | "name"
  | "brand"
  | "category"
  | "subcategory"
  | "price"
  | "flavor"
  | "puffs"
  | "volume"
  | "emoji"
  | "color"
  | "image_url"
  | "description"
  | "is_active"
  | "sort_order"
  | "stock_quantity";

function diffProductFields(
  oldData: Record<string, any>,
  newData: Record<string, any>,
): { field: string; oldValue: any; newValue: any }[] {
  const fields: ProductField[] = [
    "slug",
    "name",
    "brand",
    "category",
    "subcategory",
    "price",
    "flavor",
    "puffs",
    "volume",
    "emoji",
    "color",
    "image_url",
    "description",
    "is_active",
    "sort_order",
    "stock_quantity",
  ];
  const changes: { field: string; oldValue: any; newValue: any }[] = [];
  for (const f of fields) {
    const oldVal = oldData[f];
    const newVal = newData[f];
    if (oldVal !== newVal) {
      changes.push({ field: f, oldValue: oldVal, newValue: newVal });
    }
  }
  return changes;
}

async function logProductActivity(
  context: { supabase: any },
  payload: {
    product_id?: string | null;
    action: string;
    details: Record<string, any>;
    product_snapshot?: Record<string, any> | null;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("product_activity_log" as any).insert({
    product_id: payload.product_id || null,
    action: payload.action,
    details: payload.details,
    product_snapshot: payload.product_snapshot || null,
  });
}

export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("products" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const { formatImageUrl, buildDescription, getSignedImageUrl } =
      await import("./product-helpers");
    const mapped = await Promise.all(
      (data ?? []).map(async (p: any) => ({
        ...p,
        image_url: await getSignedImageUrl(p.image_url),
        description: buildDescription(p),
        is_active: p.is_active !== false,
      })),
    );
    return mapped;
  });

export const adminUpsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => productSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let previousSnapshot: Record<string, any> | null = null;
    let changes: { field: string; oldValue: any; newValue: any }[] = [];

    if (data.id && data.id.trim() !== "") {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from("products" as any)
        .select("*")
        .eq("id", data.id)
        .single();
      if (!fetchError && existing) {
        previousSnapshot = existing as any;
        changes = diffProductFields(existing as any, data);
      }
    }

    const row = {
      ...data,
      flavor: data.flavor?.trim() || null,
      puffs: data.puffs?.trim() || null,
      volume: data.volume?.trim() || null,
      subcategory: data.subcategory?.trim() || null,
      image_url: data.image_url?.trim() || null,
      description: data.description?.trim() || null,
    };

    if (data.id && data.id.trim() !== "") {
      const { id, ...updateFields } = row;
      const { error } = await supabaseAdmin
        .from("products" as any)
        .update(updateFields)
        .eq("id", id);
      if (error) throw error;

      if (changes.length > 0) {
        await logProductActivity(context, {
          product_id: id,
          action: "update",
          details: { changed_fields: changes.map((c) => c.field), changes },
          product_snapshot: previousSnapshot,
        });
      }

      return { id: data.id };
    }

    const { id, ...insertFields } = row;
    const { data: inserted, error } = await supabaseAdmin
      .from("products" as any)
      .insert(insertFields)
      .select("id")
      .single();
    if (error) throw error;

    const newId = (inserted as unknown as { id: string }).id;
    await logProductActivity(context, {
      product_id: newId,
      action: "create",
      details: { name: row.name, category: row.category },
      product_snapshot: { ...row, id: newId },
    });

    return { id: newId };
  });

export const adminUploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const formData = data as FormData | undefined;
    if (!(formData instanceof FormData)) {
      throw new Error("Ожидается FormData");
    }

    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new Error("Файл не выбран");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Недопустимый формат файла");
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("Файл слишком большой (макс. 5MB)");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const filePath = fileName;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.storage.from("product-images").upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      throw new Error(`Ошибка загрузки: ${error.message}`);
    }

    return { path: filePath };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("products" as any)
      .select("*")
      .eq("id", data.id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabaseAdmin
      .from("products" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw error;

    if (existing) {
      await logProductActivity(context, {
        product_id: (existing as any).id,
        action: "delete",
        details: {
          name: (existing as any).name,
          category: (existing as any).category,
          brand: (existing as any).brand,
        },
        product_snapshot: existing as any,
      });
    }

    return { ok: true };
  });

export const adminToggleActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("products" as any)
      .select("name, category, brand")
      .eq("id", data.id)
      .single();

    const { error } = await supabaseAdmin
      .from("products" as any)
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw error;

    if (!fetchError && existing) {
      await logProductActivity(context, {
        product_id: data.id,
        action: data.is_active ? "activate" : "deactivate",
        details: {
          name: (existing as any).name,
          category: (existing as any).category,
          brand: (existing as any).brand,
        },
        product_snapshot: null,
      });
    }

    return { ok: true };
  });

export const adminUpdateStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string(), stock_quantity: z.number().int().nonnegative() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("products" as any)
      .select("name, category, brand, stock_quantity")
      .eq("id", data.id)
      .single();

    const oldStock = fetchError ? null : (existing as any)?.stock_quantity;

    const { error } = await supabaseAdmin
      .from("products" as any)
      .update({ stock_quantity: data.stock_quantity })
      .eq("id", data.id);
    if (error) throw error;

    if (!fetchError && existing) {
      await logProductActivity(context, {
        product_id: data.id,
        action: "stock_update",
        details: {
          name: (existing as any).name,
          category: (existing as any).category,
          brand: (existing as any).brand,
          old_stock_quantity: oldStock,
          new_stock_quantity: data.stock_quantity,
        },
        product_snapshot: null,
      });
    }

    return { ok: true };
  });

export const adminBulkUpdateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ ids: z.array(z.string()).min(1), image_url: z.string().trim().max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("products" as any)
      .update({ image_url: data.image_url })
      .in("id", data.ids);

    if (error) throw error;

    await logProductActivity(context, {
      product_id: null,
      action: "bulk_update_image",
      details: { product_ids: data.ids, image_url: data.image_url, count: data.ids.length },
      product_snapshot: null,
    });

    return { ok: true, updated: data.ids.length };
  });

export const adminBulkUpdateBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ ids: z.array(z.string()).min(1), brand: z.string().trim().min(1).max(1000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("products" as any)
      .update({ brand: data.brand })
      .in("id", data.ids);

    if (error) throw error;

    await logProductActivity(context, {
      product_id: null,
      action: "bulk_update_brand",
      details: { product_ids: data.ids, brand: data.brand, count: data.ids.length },
      product_snapshot: null,
    });

    return { ok: true, updated: data.ids.length };
  });

export const adminMoveOrCopyProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string(),
        targetCategory: z.string().trim().min(1),
        targetSubcategory: z.string().trim().max(1000).optional().nullable(),
        mode: z.enum(["move", "copy"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const targetSubcategory = (data.targetSubcategory || "").trim() || null;

    const { data: source, error: fetchError } = await supabaseAdmin
      .from("products" as any)
      .select("*")
      .eq("id", data.id)
      .single();
    if (fetchError) throw fetchError;
    if (!source) throw new Error("Товар не найден");

    const src = source as any;

    if (data.mode === "move") {
      const updatePayload: Record<string, any> = { category: data.targetCategory };
      updatePayload.subcategory = targetSubcategory;
      const { error } = await supabaseAdmin
        .from("products" as any)
        .update(updatePayload)
        .eq("id", data.id);
      if (error) throw error;

      await logProductActivity(context, {
        product_id: data.id,
        action: "move",
        details: {
          name: src.name,
          oldCategory: src.category,
          oldSubcategory: src.subcategory,
          targetCategory: data.targetCategory,
          targetSubcategory,
        },
        product_snapshot: src,
      });

      return { ok: true, mode: "move" };
    }

    const baseSlug = (src.slug || "").trim() || `product-${Date.now()}`;
    const newSlug = `${baseSlug}-copy-${Date.now()}`;
    const { error: insertError } = await supabaseAdmin.from("products" as any).insert({
      slug: newSlug,
      name: "Копия: " + src.name,
      brand: src.brand,
      category: data.targetCategory,
      subcategory: targetSubcategory ?? src.subcategory,
      price: src.price,
      flavor: src.flavor,
      puffs: src.puffs,
      volume: src.volume,
      emoji: src.emoji,
      color: src.color,
      image_url: src.image_url,
      description: src.description,
      is_active: src.is_active,
      sort_order: src.sort_order,
    });
    if (insertError) throw insertError;

    await logProductActivity(context, {
      product_id: data.id,
      action: "copy",
      details: {
        name: src.name,
        sourceCategory: src.category,
        sourceSubcategory: src.subcategory,
        targetCategory: data.targetCategory,
        targetSubcategory,
        newSlug,
      },
      product_snapshot: src,
    });

    return { ok: true, mode: "copy" };
  });

// ---- Admin Telegram whitelist ----

export const adminListTelegramUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("admin_telegram_users" as any)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const adminAddTelegramUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        telegram_username: z
          .string()
          .trim()
          .min(3)
          .max(60)
          .transform((s) => s.replace(/^@+/, "")),
        note: z.string().trim().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("admin_telegram_users" as any).insert({
      telegram_username: data.telegram_username,
      note: data.note?.trim() || null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const adminRemoveTelegramUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("admin_telegram_users" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const adminGetMeetingTimes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase
      .from("admin_telegram_users" as any)
      .select("note")
      .eq("telegram_username", "__meeting_times__")
      .maybeSingle() as any);
    if (error) throw error;
    if (data && data.note) {
      try {
        const parsed = JSON.parse(data.note);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((item) => typeof item === "string")
        ) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse meeting times:", e);
      }
    }
    return [
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "20:20",
      "21:00",
      "После 21:00 — отдам там, где буду находиться. Закажите заранее!",
      "Для заказа Яндекс Доставки",
    ];
  });

export const adminUpdateMeetingTimes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ times: z.array(z.string()) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: existing } = await (context.supabase
      .from("admin_telegram_users" as any)
      .select("id")
      .eq("telegram_username", "__meeting_times__")
      .maybeSingle() as any);

    if (existing) {
      const { error } = await context.supabase
        .from("admin_telegram_users" as any)
        .update({ note: JSON.stringify(data.times) })
        .eq("telegram_username", "__meeting_times__");
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("admin_telegram_users" as any).insert({
        telegram_username: "__meeting_times__",
        note: JSON.stringify(data.times),
      });
      if (error) throw error;
    }
    return { ok: true };
  });

export const getMeetingTimes = createServerFn({ method: "GET" }).handler(async () => {
  const defaults = [
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "20:20",
    "21:00",
    "После 21:00 — отдам там, где буду находиться. Закажите заранее!",
    "Для заказа Яндекс Доставки",
  ];

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin
      .from("admin_telegram_users" as any)
      .select("note")
      .eq("telegram_username", "__meeting_times__")
      .maybeSingle() as any);

    if (!error && data && data.note) {
      try {
        return JSON.parse(data.note) as string[];
      } catch (e) {
        console.error("Failed to parse meeting times:", e);
      }
    }
  } catch (err) {
    console.warn("[meetingTimes] Failed to fetch meeting times, using defaults", err);
  }

  return defaults;
});

export const getAnimationSettings = createServerFn({ method: "GET" }).handler(async () => {
  const defaults = {
    leaves: { enabled: true, from: 1, to: 12, count: 30 },
    snow: { enabled: true, from: 1, to: 12, count: 40 },
  };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin
      .from("app_settings" as any)
      .select("value")
      .eq("key", "animation_settings")
      .maybeSingle() as any);

    if (!error && data && data.value) {
      try {
        return data.value as {
          leaves: { enabled: boolean; from: number; to: number; count: number };
          snow: { enabled: boolean; from: number; to: number; count: number };
        };
      } catch {
        // keep defaults on parse error
      }
    }
  } catch {
    // table may not exist yet or RPC failed; return defaults
  }

  return defaults;
});

export const adminUpdateAnimationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leaves: z.object({
          enabled: z.boolean(),
          from: z.number().min(1).max(12),
          to: z.number().min(1).max(12),
          count: z.number().min(0).max(200),
        }),
        snow: z.object({
          enabled: z.boolean(),
          from: z.number().min(1).max(12),
          to: z.number().min(1).max(12),
          count: z.number().min(0).max(200),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("app_settings" as any)
      .upsert({ key: "animation_settings", value: data });

    if (error) throw error;

    return { ok: true };
  });

export const adminListProductActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("product_activity_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const adminClearProductActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("product_activity_log" as any)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
    return { ok: true };
  });

export const adminRestoreProductFromActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: activity, error: fetchError } = await supabaseAdmin
      .from("product_activity_log" as any)
      .select("*")
      .eq("id", data.id)
      .eq("action", "delete")
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!activity) throw new Error("Запись не найдена или товар не был удалён");

    const snapshot = (activity as any).product_snapshot;
    if (!snapshot) throw new Error("Нет данных товара для восстановления");

    const restored = {
      slug: (snapshot.slug || "") + "-restored-" + Date.now(),
      name: snapshot.name,
      brand: snapshot.brand,
      category: snapshot.category,
      subcategory: snapshot.subcategory,
      price: snapshot.price,
      flavor: snapshot.flavor,
      puffs: snapshot.puffs,
      volume: snapshot.volume,
      emoji: snapshot.emoji || "🔥",
      color: snapshot.color || "pink",
      image_url: snapshot.image_url,
      description: snapshot.description,
      is_active: true,
      sort_order: snapshot.sort_order ?? 0,
      stock_quantity: snapshot.stock_quantity ?? 0,
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("products" as any)
      .insert(restored)
      .select("id")
      .single();

    if (insertError) throw insertError;

    await logProductActivity(context, {
      product_id: (inserted as any).id,
      action: "restore",
      details: {
        name: snapshot.name,
        category: snapshot.category,
        brand: snapshot.brand,
        restored_from_activity_id: data.id,
      },
      product_snapshot: { ...restored, id: (inserted as any).id },
    });

    return { id: (inserted as any).id };
  });
