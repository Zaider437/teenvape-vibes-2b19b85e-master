import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// In-memory cache to store orders and make the cancellation page fully functional without Supabase!
const ordersCache = new Map<string, any>();

function getEnv(key: string): string | undefined {
  if (key === "TELEGRAM_API_KEY") {
    return (
      (globalThis as any).TELEGRAM_API_KEY ||
      (globalThis as any).env?.TELEGRAM_API_KEY ||
      (globalThis as any).__env__?.TELEGRAM_API_KEY ||
      process.env.TELEGRAM_API_KEY
    );
  }
  if (key === "TELEGRAM_CHAT_ID") {
    return (
      (globalThis as any).TELEGRAM_CHAT_ID ||
      (globalThis as any).env?.TELEGRAM_CHAT_ID ||
      (globalThis as any).__env__?.TELEGRAM_CHAT_ID ||
      process.env.TELEGRAM_CHAT_ID
    );
  }
  if (key === "SMTP_HOST") {
    return (
      (globalThis as any).SMTP_HOST ||
      (globalThis as any).env?.SMTP_HOST ||
      (globalThis as any).__env__?.SMTP_HOST ||
      process.env.SMTP_HOST
    );
  }
  if (key === "SMTP_PORT") {
    return (
      (globalThis as any).SMTP_PORT ||
      (globalThis as any).env?.SMTP_PORT ||
      (globalThis as any).__env__?.SMTP_PORT ||
      process.env.SMTP_PORT
    );
  }
  if (key === "SMTP_USER") {
    return (
      (globalThis as any).SMTP_USER ||
      (globalThis as any).env?.SMTP_USER ||
      (globalThis as any).__env__?.SMTP_USER ||
      process.env.SMTP_USER
    );
  }
  if (key === "SMTP_PASS") {
    return (
      (globalThis as any).SMTP_PASS ||
      (globalThis as any).env?.SMTP_PASS ||
      (globalThis as any).__env__?.SMTP_PASS ||
      process.env.SMTP_PASS
    );
  }
  if (key === "NOTIFY_EMAIL") {
    return (
      (globalThis as any).NOTIFY_EMAIL ||
      (globalThis as any).env?.NOTIFY_EMAIL ||
      (globalThis as any).__env__?.NOTIFY_EMAIL ||
      process.env.NOTIFY_EMAIL
    );
  }
  return undefined;
}

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  qty: z.number().int().positive(),
  flavor: z.string().nullable().optional(),
});

const orderSchema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().min(5).max(40),
  customer_address: z.string().trim().min(3).max(500),
  customer_note: z.string().trim().max(1000).optional().nullable(),
  items: z.array(itemSchema).min(1).max(50),
  total_amount: z.number().nonnegative(),
  origin: z.string().optional(),
});

interface ServerContext {
  cloudflare?: {
    env?: Record<string, string>;
  };
  env?: Record<string, string>;
}

export const createOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as ServerContext;
    console.log("[createOrder] context keys:", Object.keys(ctx || {}));
    console.log("[createOrder] context.cloudflare keys:", Object.keys(ctx?.cloudflare || {}));
    console.log("[createOrder] context.env keys:", Object.keys(ctx?.env || {}));
    console.log(
      "[createOrder] globalThis keys:",
      Object.keys(globalThis).filter(
        (k) => k.includes("TELEGRAM") || k.includes("env") || k.includes("process"),
      ),
    );

    const env = ctx?.cloudflare?.env || ctx?.env || {};
    const notifyEmail = env.NOTIFY_EMAIL || getEnv("NOTIFY_EMAIL") || "375333631370moroz@gmail.com";
    // Authoritative product catalog lookup by ID
    const itemIds = data.items.map((i) => i.id).filter(Boolean);
    let dbProducts: any[] = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prods, error: pErr } = await supabaseAdmin
        .from("products" as any)
        .select("*")
        .in("id", itemIds);
      if (!pErr && prods && prods.length > 0) {
        dbProducts = prods;
      }
    } catch (e) {
      console.warn("[createOrder] direct Supabase query failed, falling back", e);
    }

    if (dbProducts.length === 0) {
      try {
        const { fetchProducts } = await import("./products");
        dbProducts = await fetchProducts();
      } catch (e) {
        console.warn("[createOrder] fallback fetchProducts failed", e);
      }
    }

    const { formatImageUrl } = await import("./product-helpers");
    const byId = new Map(
      dbProducts.map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          brand: p.brand || "",
          price: p.price,
          stock_quantity: p.stock_quantity ?? 0,
          flavor: p.flavor || null,
          image: formatImageUrl(p.image_url || p.image) || null,
        },
      ]),
    );

    const trustedItems = data.items.map((i) => {
      const product = byId.get(i.id);
      if (!product) {
        console.warn(`[order] Product not found in catalog: ${i.id}. Using client-supplied data.`);
        return {
          id: i.id,
          name: i.name,
          brand: "",
          price: i.price,
          qty: i.qty,
          flavor: i.flavor || null,
          image: null,
        };
      }
      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        qty: i.qty,
        flavor: product.flavor || null,
        image: product.image || null,
      };
    });
    const trustedTotal = Number(
      trustedItems.reduce((sum, i) => sum + i.price * i.qty, 0).toFixed(2),
    );

    for (const item of trustedItems) {
      const dbProduct = byId.get(item.id);
      if (
        dbProduct &&
        dbProduct.stock_quantity !== undefined &&
        item.qty > dbProduct.stock_quantity
      ) {
        return {
          error: `Недостаточно товара "${item.name}" на складе. Доступно: ${dbProduct.stock_quantity}, запрошено: ${item.qty}.`,
        };
      }
    }

    const orderId = crypto.randomUUID();

    const orderData = {
      id: orderId,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_address: data.customer_address,
      customer_note: data.customer_note,
      items: trustedItems.map((i) => ({
        id: i.id,
        name: i.name,
        brand: i.brand,
        qty: i.qty,
        price: i.price,
        flavor: i.flavor,
        image: i.image,
      })),
      total_amount: trustedTotal,
      status: "new" as const,
      created_at: new Date().toISOString(),
    };

    const cancellationToken = crypto.randomUUID();

    // Save the order details in our in-memory cache so the cancellation page can load them!
    ordersCache.set(cancellationToken, { ...orderData, cancellation_token: cancellationToken });

    // Persist order to Supabase so cancellation link works across server instances/restarts
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("orders" as any).insert({
        id: orderId,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        customer_note: data.customer_note,
        items: orderData.items,
        total_amount: trustedTotal,
        status: "new",
        cancellation_token: cancellationToken,
      });
    } catch (err) {
      console.warn("[order] Failed to persist order to Supabase, relying on in-memory cache", err);
    }

    // Build cancellation link from the request origin or fallback
    let cancelUrl: string | undefined;
    let clientOrigin = "https://vape-vibe.lovable.app";
    try {
      if (data.origin && !data.origin.includes("zaider437-teenvape-vibes-2b19b85e.workers.dev")) {
        clientOrigin = data.origin;
      }
      cancelUrl = `${clientOrigin}/order-cancel?token=${cancellationToken}`;
    } catch (err) {
      console.warn("[order] could not build cancel URL from request", err);
    }

    // Send email notification via external email API (Cloudflare Workers compatible).
    // Set EMAIL_API_URL in wrangler.toml [vars] to enable email sending.
    let emailSent = false;
    try {
      const emailApiUrl = env.EMAIL_API_URL || getEnv("EMAIL_API_URL");
      if (emailApiUrl) {
        const html = `<h1>New Order LoveVape #${orderData.id.slice(0, 8)}</h1>
<p>Customer: ${data.customer_name}</p>
<p>Phone: ${data.customer_phone}</p>
<p>Address: ${data.customer_address}</p>
${data.customer_note ? `<p>Note: ${data.customer_note}</p>` : ""}
<p>Items:</p>
<ul>${trustedItems.map((i) => `<li>${i.name} ${i.brand ? `(${i.brand})` : ""}${i.flavor ? `, ${i.flavor}` : ""} × ${i.qty} — ${(i.price * i.qty).toFixed(2)} BYN</li>`).join("")}</ul>
<p><strong>Total: ${trustedTotal.toFixed(2)} BYN</strong></p>
<p>Cancel: <a href="${cancelUrl || "#"}">${cancelUrl || "#"}</a></p>`;
        const emailRes = await fetch(emailApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: notifyEmail,
            subject: `🔥 Новый заказ LoveVape #${orderData.id.slice(0, 8)}`,
            html,
          }),
          signal: AbortSignal.timeout(6000),
        });
        emailSent = emailRes.ok;
        if (!emailRes.ok) {
          console.warn("[order] email API returned", emailRes.status, await emailRes.text());
        }
      } else {
        console.warn("[order] EMAIL_API_URL not configured, skipping email notification");
      }
    } catch (err) {
      console.warn("[order] email send skipped:", err);
    }

    // Telegram notification (best-effort)
    try {
      await sendTelegramNotification({
        orderId: orderData.id,
        customerName: data.customer_name,
        customerPhone: data.customer_phone,
        customerAddress: data.customer_address,
        customerNote: data.customer_note,
        items: trustedItems,
        total: trustedTotal,
        cancelUrl,
        origin: clientOrigin,
        env,
      });
    } catch (err) {
      console.warn("[order] telegram notification skipped:", err);
    }

    // Decrement stock quantities for ordered products and auto-deactivate when stock hits 0
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (const item of trustedItems) {
        const dbProduct = byId.get(item.id);
        if (dbProduct && dbProduct.stock_quantity !== undefined) {
          const newQty = Math.max(0, dbProduct.stock_quantity - item.qty);
          const updateData: { stock_quantity: number; is_active?: boolean } = {
            stock_quantity: newQty,
          };
          if (newQty === 0) {
            updateData.is_active = false;
          }
          await supabaseAdmin
            .from("products" as any)
            .update(updateData)
            .eq("id", item.id);
        }
      }
    } catch (err) {
      console.warn("[order] stock decrement failed:", err);
    }

    try {
      const { invalidateProductsCache } = await import("./products");
      invalidateProductsCache();
    } catch (err) {
      console.warn("[order] cache invalidation failed:", err);
    }

    return { id: orderData.id, emailSent, cancellationToken };
  });

// Send order notification to Telegram (best-effort, non-blocking failure)
async function sendTelegramNotification(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerNote?: string | null;
  items: Array<{
    name: string;
    brand: string;
    qty: number;
    price: number;
    flavor?: string | null;
    image?: string | null;
  }>;
  total: number;
  cancelUrl?: string;
  origin?: string;
  env?: any;
}) {
  const tgKey =
    params.env?.TELEGRAM_API_KEY ||
    getEnv("TELEGRAM_API_KEY") ||
    "8777027201:AAFD8QYw5ita5wIzYFRJTS4LH75DF6eU1jo";
  const chatId = (
    params.env?.TELEGRAM_CHAT_ID ||
    getEnv("TELEGRAM_CHAT_ID") ||
    "-1004456309860"
  )?.trim();
  if (!tgKey || !chatId) {
    console.warn("[order] telegram notification skipped: missing tgKey or chatId", {
      tgKey: !!tgKey,
      chatId: !!chatId,
    });
    return false;
  }

  const note =
    params.customerNote && params.customerNote.trim()
      ? params.customerNote
      : "... не определен ...";
  const origin =
    params.origin && !params.origin.includes("zaider437-teenvape-vibes-2b19b85e.workers.dev")
      ? params.origin
      : "https://vape-vibe.lovable.app";

  const itemsHtml = params.items
    .map(
      (i) =>
        `• Товар: ${escapeHtml(i.name)} (${escapeHtml(i.brand)})${i.flavor ? `, вкус: ${escapeHtml(i.flavor)}` : ""}; ${i.qty} шт. по ${i.price.toFixed(2)} BYN — ${(i.price * i.qty).toFixed(2)} BYN`,
    )
    .join("\n");

  const lines = [
    `🔥 <b>Новый заказ</b> #${escapeHtml(params.orderId.slice(0, 8))}`,
    `👤 ID в Telegram: ${escapeHtml(params.customerName)}`,
    `📍 Время встречи: ${escapeHtml(params.customerAddress)}`,
    `📝 Комментарий: ${escapeHtml(note)}`,
    ``,
    `🛒 <b>Состав заявки:</b>`,
    itemsHtml,
    ``,
    `💰 <b>Итого: ${params.total.toFixed(2)} BYN</b>`,
  ];

  if (params.cancelUrl) {
    lines.push(``, `🔗 Ссылка для отмены заказа:`, params.cancelUrl);
  }

  // Filter media for valid publicly accessible URLs
  const isLocalHost = origin.includes("localhost") || origin.includes("127.0.0.1");
  const media = params.items
    .filter((i) => i.image)
    .map((i) => {
      let imageUrl = i.image!;
      if (!imageUrl.startsWith("http")) {
        if (isLocalHost) return null;
        imageUrl = `${origin}${imageUrl}`;
      }
      const caption = `<b>${escapeHtml(i.name)}</b>\n${i.flavor ? `Вкус: ${escapeHtml(i.flavor)}\n` : ""}${i.qty} шт. × ${i.price.toFixed(2)} BYN = ${(i.price * i.qty).toFixed(2)} BYN`;
      return {
        type: "photo" as const,
        media: imageUrl,
        caption,
        parse_mode: "HTML" as const,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .slice(0, 10);

  // Send photo(s) if available (best-effort, does not block message)
  try {
    if (media.length === 1) {
      const photoController = new AbortController();
      const photoTimeout = setTimeout(() => photoController.abort(), 6000);
      try {
        await fetch(`https://api.telegram.org/bot${tgKey}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: media[0].media,
            caption: media[0].caption,
            parse_mode: "HTML",
          }),
          signal: photoController.signal,
        });
      } finally {
        clearTimeout(photoTimeout);
      }
    } else if (media.length >= 2) {
      const mediaController = new AbortController();
      const mediaTimeout = setTimeout(() => mediaController.abort(), 6000);
      try {
        await fetch(`https://api.telegram.org/bot${tgKey}/sendMediaGroup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            media: media,
          }),
          signal: mediaController.signal,
        });
      } finally {
        clearTimeout(mediaTimeout);
      }
    }
  } catch (err) {
    console.warn("[order] telegram photo(s) send skipped:", err);
  }

  // Always send the main order text message
  try {
    const textController = new AbortController();
    const textTimeout = setTimeout(() => textController.abort(), 8000);

    const bodyPayload: any = {
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
    };

    if (params.cancelUrl) {
      bodyPayload.reply_markup = {
        inline_keyboard: [
          [
            {
              text: "❌ Отменить заказ",
              url: params.cancelUrl,
            },
          ],
        ],
      };
    }

    const textRes = await fetch(`https://api.telegram.org/bot${tgKey}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
      signal: textController.signal,
    });
    clearTimeout(textTimeout);
    if (!textRes.ok) {
      console.warn("[order] telegram send failed", textRes.status, await textRes.text());
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[order] telegram fetch failed or timed out", err);
    return false;
  }
}

async function sendTelegramCancellationNotification(params: {
  orderId: string;
  customerName: string;
  customerAddress: string;
  items: Array<{ name: string; brand?: string; qty: number; price?: number; flavor?: string | null }>;
  total?: number;
  env?: any;
}) {
  const tgKey =
    params.env?.TELEGRAM_API_KEY ||
    getEnv("TELEGRAM_API_KEY") ||
    "8777027201:AAFD8QYw5ita5wIzYFRJTS4LH75DF6eU1jo";
  const chatId = (
    params.env?.TELEGRAM_CHAT_ID ||
    getEnv("TELEGRAM_CHAT_ID") ||
    "-1004456309860"
  )?.trim();
  if (!tgKey || !chatId) return false;

  const itemsHtml = (params.items || [])
    .map(
      (i) =>
        `• ${escapeHtml(i.name)}${i.brand ? ` (${escapeHtml(i.brand)})` : ""}${i.flavor ? `, вкус: ${escapeHtml(i.flavor)}` : ""}; ${i.qty} шт.`,
    )
    .join("\n");

  const lines = [
    `❌ <b>Заказ отменён</b> #${escapeHtml(params.orderId.slice(0, 8))}`,
    `👤 ID в Telegram: ${escapeHtml(params.customerName)}`,
    `📍 Время встречи: ${escapeHtml(params.customerAddress)}`,
    ``,
    `🛒 <b>Состав отменённой заявки:</b>`,
    itemsHtml || "• Состав не указан",
    ``,
    `💰 <b>Сумма отмены: ${Number(params.total || 0).toFixed(2)} BYN</b>`,
    `♻️ <i>Товар автоматически возвращён в админку и снова доступен.</i>`,
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${tgKey}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch (err) {
    console.warn("[cancelOrder] telegram cancel notification failed:", err);
    return false;
  }
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const tokenSchema = z.object({ token: z.string().min(1) });

export const getOrderByToken = createServerFn({ method: "GET" })
  .validator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: order, error } = await supabaseAdmin
        .from("orders" as any)
        .select("*")
        .eq("cancellation_token", data.token)
        .maybeSingle();

      if (!error && order) {
        return {
          id: order.id,
          customer_name: order.customer_name,
          customer_address: order.customer_address,
          customer_note: order.customer_note,
          items: typeof order.items === "string" ? JSON.parse(order.items) : order.items,
          total_amount: order.total_amount,
          status: order.status,
          created_at: order.created_at,
        };
      }
    } catch (err) {
      console.warn("[getOrderByToken] Failed to fetch from Supabase, falling back to cache", err);
    }

    const order = ordersCache.get(data.token);
    if (order) {
      return {
        id: order.id,
        customer_name: order.customer_name,
        customer_address: order.customer_address,
        customer_note: order.customer_note,
        items: order.items,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
      };
    }

    return null;
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    let orderToCancel: any = null;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: order, error } = await supabaseAdmin
        .from("orders" as any)
        .select("*")
        .eq("cancellation_token", data.token)
        .maybeSingle();

      if (!error && order) {
        orderToCancel = order;
      }
    } catch (err) {
      console.warn("[cancelOrder] Failed to fetch order from Supabase, falling back to cache", err);
    }

    if (!orderToCancel) {
      orderToCancel = ordersCache.get(data.token);
    }

    if (!orderToCancel) {
      return { success: false, error: "Заказ не найден" };
    }

    if (orderToCancel.status === "cancelled") {
      return { success: true, alreadyCancelled: true };
    }

    const items =
      typeof orderToCancel.items === "string"
        ? JSON.parse(orderToCancel.items)
        : orderToCancel.items || [];

    // Sum quantities per product ID
    const qtyByProduct = new Map<string, number>();
    for (const i of items) {
      if (i.id) {
        qtyByProduct.set(i.id, (qtyByProduct.get(i.id) ?? 0) + (Number(i.qty) || 1));
      }
    }

    const productIds = Array.from(qtyByProduct.keys());

    // Restore stock and reactivate product if it was zero-stock
    if (productIds.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: products } = await supabaseAdmin
          .from("products" as any)
          .select("id, stock_quantity")
          .in("id", productIds);

        if (products) {
          for (const p of products) {
            const returnQty = qtyByProduct.get(p.id) ?? 0;
            if (returnQty > 0) {
              const newStock = Math.max(0, (p.stock_quantity ?? 0) + returnQty);
              await supabaseAdmin
                .from("products" as any)
                .update({
                  stock_quantity: newStock,
                  ...(newStock > 0 ? { is_active: true } : {}),
                })
                .eq("id", p.id);
            }
          }
        }
      } catch (err) {
        console.warn("[cancelOrder] Failed to restore stock:", err);
      }
    }

    try {
      const { invalidateProductsCache } = await import("./products");
      invalidateProductsCache();
    } catch (err) {
      console.warn("[cancelOrder] cache invalidation failed:", err);
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("orders" as any)
        .update({ status: "cancelled" })
        .eq("cancellation_token", data.token);
    } catch (err) {
      console.warn("[cancelOrder] Failed to update status in Supabase:", err);
    }

    const cached = ordersCache.get(data.token);
    if (cached) {
      cached.status = "cancelled";
      ordersCache.set(data.token, cached);
    }

    // Send Telegram cancellation notice
    try {
      await sendTelegramCancellationNotification({
        orderId: orderToCancel.id,
        customerName: orderToCancel.customer_name,
        customerAddress: orderToCancel.customer_address,
        items,
        total: orderToCancel.total_amount,
      });
    } catch (err) {
      console.warn("[cancelOrder] telegram cancel notification failed:", err);
    }

    return { success: true, alreadyCancelled: false };
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
  } catch (e) {
    console.error("Failed to load meeting times:", e);
  }

  return defaults;
});

export const debugEnv = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const keys = {
    contextKeys: Object.keys(context || {}),
    cloudflareKeys: Object.keys((context as any)?.cloudflare || {}),
    cloudflareEnvKeys: Object.keys((context as any)?.cloudflare?.env || {}),
    envKeys: Object.keys((context as any)?.env || {}),
    processEnvKeys: [],
    globalThisKeys: Object.keys(globalThis).filter(
      (k) =>
        k.includes("TELEGRAM") ||
        k.includes("env") ||
        k.includes("process") ||
        k.includes("SUPABASE"),
    ),
    globalThisEnvKeys: Object.keys((globalThis as any).env || {}),
  };
  return keys;
});
