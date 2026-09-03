import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search, X, ShoppingBag, Plus, Minus, Trash2 } from "lucide-react";
import { CartProvider, useCart, type CartItem } from "@/lib/cart";
import { fetchProductsByManufacturerSlug, type Product } from "@/lib/products";
import { createOrder, getMeetingTimes } from "@/lib/orders.functions";
import { toast, Toaster } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/b/$slug")({
  head: () => ({
    meta: [
      { title: "Производитель — LoveVape" },
      { name: "description", content: "Каталог товаров производителя" },
    ],
  }),
  component: () => {
    return (
      <CartProvider>
        <ManufacturerPage />
        <Toaster position="top-center" theme="dark" richColors />
      </CartProvider>
    );
  },
});

function ManufacturerPage() {
  const { slug } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [manufacturer, setManufacturer] = useState<{ name: string; slug: string } | null>(null);
  const [meetingTimes, setMeetingTimes] = useState<string[]>([]);
  const [loadingMeetingTimes, setLoadingMeetingTimes] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [query, setQuery] = useState("");

  const fetchBySlug = useServerFn(fetchProductsByManufacturerSlug);
  const { items } = useCart();

  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.product.id, (item.product.id === item.product.id ? item.qty : 0));
    }
    return map;
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    fetchBySlug({ data: { slug } })
      .then((data) => {
        if (!cancelled) {
          setProducts(data.products);
          setManufacturer(data.manufacturer);
        }
      })
      .catch((err) => {
        console.error("[manufacturer] load failed", err);
        if (!cancelled) toast.error("Не удалось загрузить производителя");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getMeetingTimes()
      .then((data) => {
        if (!cancelled) setMeetingTimes(data);
      })
      .catch((err) => {
        console.error("[manufacturer] load meeting times failed", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingMeetingTimes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, fetchBySlug]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = [p.name, p.brand, p.flavor, p.puffs, p.volume].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [products, query]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Назад в каталог
          </Link>
          <div className="ml-auto text-sm font-bold text-muted-foreground">
            {manufacturer ? `Производитель: ${manufacturer.name}` : "Загрузка…"}
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-3 sm:px-4 mt-4 sm:mt-6">
        <h1 className="font-display text-2xl sm:text-3xl text-foreground">
          {manufacturer ? manufacturer.name : "Производитель"}
          <span className="text-primary">.</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {loading ? "Загрузка…" : `${filtered.length} товаров`}
        </p>
      </section>

      <div className="px-3 sm:px-4 mt-3 sm:mt-4">
        <div className="relative">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" strokeWidth={2.5} />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск товара…"
            className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-9 sm:pr-10 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-muted grid place-items-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5 sm:w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="px-3 sm:px-4 mt-6 sm:mt-8 text-center text-sm text-muted-foreground">
          Загружаем…
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-3 sm:px-4 mt-6 sm:mt-8 text-center">
          <p className="text-sm text-muted-foreground">Ничего не найдено</p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs px-5 py-2.5 rounded-full glow-soft"
          >
            В каталог
          </Link>
        </div>
      ) : (
        <section className="px-3 sm:px-4 mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={(product) => setSelectedProduct(product)} />
          ))}
        </section>
      )}

      {selectedProduct && (
        <Dialog
          open={!!selectedProduct}
          onOpenChange={(open) => {
            if (!open) setSelectedProduct(null);
          }}
        >
          <DialogContent className="max-w-sm sm:max-w-md max-h-[85vh] overflow-y-auto p-4 sm:p-5 gap-3">
            <DialogHeader>
              <DialogTitle className="font-display text-lg pr-8">{selectedProduct.name}</DialogTitle>
            </DialogHeader>
            <ProductDetail product={selectedProduct} />
          </DialogContent>
        </Dialog>
      )}

      {cartOpen && (
        <CartSheet
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}
      {checkoutOpen && (
        <CheckoutSheet
          onClose={() => setCheckoutOpen(false)}
          meetingTimes={meetingTimes}
          onOrderPlaced={(orderedItems) => {
            const orderedIds = new Set(orderedItems.map((i) => i.product.id));
            setProducts((prev) =>
              prev.map((p) =>
                orderedIds.has(p.id)
                  ? {
                      ...p,
                      stock_quantity: Math.max(
                        0,
                        (p.stock_quantity ?? 0) -
                          (orderedItems.find((i) => i.product.id === p.id)?.qty ?? 0),
                      ),
                    }
                  : p,
              ),
            );
          }}
        />
      )}
    </div>
  );
}

function ProductCard({ product, onOpen }: { product: Product; onOpen: (p: Product) => void }) {
  const { add, items } = useCart();
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [product.id, product.image]);
  const cartQty = items.find((i) => i.product.id === product.id)?.qty ?? 0;
  const remainingStock = (product.stock_quantity ?? Infinity) - cartQty;
  const isOutOfStock = remainingStock <= 0;
  return (
    <div
      className="relative rounded-xl border border-border overflow-hidden flex flex-col transition-all hover:border-primary/60 hover:-translate-y-0.5"
      style={{ backgroundImage: "var(--gradient-card)" }}
    >
      <div className="aspect-[4/5] sm:aspect-[3/4] grid place-items-center text-4xl sm:text-5xl bg-primary/5 border-b border-border/60 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(circle at 50% 50%, var(--primary) 0%, transparent 60%)",
          }}
        />
        <button
          onClick={() => onOpen(product)}
          className="relative w-full h-full flex items-center justify-center cursor-pointer"
          aria-label={`Подробнее о ${product.name}`}
        >
          {product.image && !broken ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="relative w-full h-full object-contain p-1.5 sm:p-2.5"
              onError={() => setBroken(true)}
            />
          ) : (
            <span className="drop-shadow-lg">{product.emoji}</span>
          )}
        </button>
      </div>
      <div className="p-2 sm:p-3 flex-1 flex flex-col">
        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {product.brand}
        </div>
        <div className="mt-0.5 font-bold text-xs sm:text-sm leading-tight text-foreground line-clamp-2 min-h-[1.5rem] sm:min-h-[2rem] flex items-center">
          {product.name}
        </div>
        {product.flavor && (
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 min-h-[1.25rem] sm:min-h-[1.5rem] flex items-center">
            {product.flavor}
          </div>
        )}
        {product.subcategory && (
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 min-h-[1.25rem] sm:min-h-[1.5rem] flex items-center">
            {product.subcategory}
          </div>
        )}
        {product.puffs && (
          <div className="text-[9px] sm:text-[10px] text-primary mt-0.5">{product.puffs}</div>
        )}
        {product.volume && (
          <div className="text-[9px] sm:text-[10px] text-primary mt-0.5">{product.volume}</div>
        )}
        <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-2">
          <div className="font-display text-lg sm:text-xl">
            {product.price}{" "}
            <span className="text-[10px] sm:text-xs text-muted-foreground">BYN</span>
          </div>
          {isOutOfStock ? (
            <span className="text-[10px] sm:text-xs text-red-500 font-bold uppercase tracking-wider">
              Нет в наличии
            </span>
          ) : (
            <button
              onClick={() => {
                const added = add(product);
                if (added) {
                  toast.success(
                    `${product.name}${product.flavor ? ` (${product.flavor})` : ""} в корзине`,
                  );
                } else {
                  toast.warning("Максимум 3 шт. одного товара");
                }
              }}
              disabled={isOutOfStock}
              className="w-9 h-9 sm:w-9 sm:h-9 rounded-lg grid place-items-center bg-primary text-primary-foreground glow-soft active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 h-4" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductDetail({ product }: { product: Product }) {
  const { add, items } = useCart();
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [product.id, product.image]);
  const cartQty = items.find((i) => i.product.id === product.id)?.qty ?? 0;
  const remainingStock = (product.stock_quantity ?? Infinity) - cartQty;
  const isOutOfStock = remainingStock <= 0;
  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="aspect-[4/3] sm:aspect-[3/4] grid place-items-center text-4xl sm:text-5xl bg-primary/5 rounded-lg overflow-hidden">
        {product.image && !broken ? (
          <img
            src={product.image}
            alt={product.name}
            decoding="async"
            className="w-full h-full object-contain p-1.5 sm:p-2"
            onError={() => setBroken(true)}
          />
        ) : (
          <span>{product.emoji}</span>
        )}
      </div>
      <div className="space-y-1 sm:space-y-1.5">
        <div className="text-xs sm:text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{product.brand}</span>
          {product.flavor && <span> · {product.flavor}</span>}
          {product.subcategory && <span> · {product.subcategory}</span>}
        </div>
        {product.puffs && <div className="text-xs sm:text-sm text-primary">{product.puffs}</div>}
        {product.volume && <div className="text-xs sm:text-sm text-primary">{product.volume}</div>}
        <div className="font-display text-lg sm:text-xl">
          {product.price} <span className="text-xs sm:text-sm text-muted-foreground">BYN</span>
        </div>
        {product.description && (
          <div className="text-xs sm:text-sm text-foreground whitespace-pre-line border-t border-border pt-1.5 sm:pt-2 mt-1.5 sm:mt-2">
            {product.description}
          </div>
        )}
        {isOutOfStock ? (
          <div className="mt-2 sm:mt-3 text-center">
            <span className="text-red-500 font-bold text-xs sm:text-sm uppercase tracking-wider">
              Нет в наличии — ждите пополнения
            </span>
          </div>
        ) : (
          <button
            onClick={() => {
              const added = add(product);
              if (added) {
                toast.success(`${product.name} в корзине`);
              } else {
                toast.warning("Максимум 3 шт. одного товара");
              }
            }}
            disabled={isOutOfStock}
            className="mt-2 sm:mt-3 w-full bg-primary text-primary-foreground font-black uppercase tracking-widest py-2 sm:py-2.5 rounded-xl glow-soft text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            В корзину
          </button>
        )}
      </div>
    </div>
  );
}

function CartSheet({
  open,
  onClose,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const { items, setQty, remove, total, clear } = useCart();
  const [brokenMap, setBrokenMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setBrokenMap({});
  }, [items]);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-t-3xl border-t-2 border-primary"
      >
        <SheetHeader className="p-3 sm:p-4 border-b border-border">
          <SheetTitle className="font-display text-xl sm:text-2xl truncate">
            Твоя корзина
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
          {items.length === 0 && (
            <p className="text-center text-muted-foreground py-8 sm:py-10 text-sm">
              Пусто. Закинь что-нибудь 💨
            </p>
          )}
          {items.map((i) => (
            <div
              key={i.product.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 sm:gap-3 items-center bg-background rounded-lg sm:rounded-xl p-1.5 sm:p-2 border border-border"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md sm:rounded-lg bg-muted grid place-items-center text-xl sm:text-2xl shrink-0 overflow-hidden">
                {i.product.image && !brokenMap[i.product.id] ? (
                  <img
                    src={i.product.image}
                    alt={i.product.name}
                    decoding="async"
                    className="w-full h-full object-contain"
                    onError={() => setBrokenMap((m) => ({ ...m, [i.product.id]: true }))}
                  />
                ) : (
                  <span>{i.product.emoji}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold truncate leading-tight">
                  {i.product.name}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate leading-tight">
                  {i.product.brand}
                </div>
                {i.product.flavor && (
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate leading-tight">
                    {i.product.flavor}
                  </div>
                )}
                <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                  {i.product.price} BYN
                </div>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <button
                  onClick={() => setQty(i.product.id, i.qty - 1)}
                  className="w-7 h-7 sm:w-7 sm:h-7 rounded grid place-items-center bg-muted"
                >
                  <Minus className="w-2.5 h-2.5 sm:w-3 h-3" />
                </button>
                <span className="w-5 sm:w-6 text-center font-bold text-xs sm:text-sm">{i.qty}</span>
                <button
                  onClick={() => setQty(i.product.id, i.qty + 1)}
                  className="w-7 h-7 sm:w-7 sm:h-7 rounded grid place-items-center bg-primary text-primary-foreground"
                >
                  <Plus className="w-2.5 h-2.5 sm:w-3 h-3" strokeWidth={3} />
                </button>
                <button
                  onClick={() => remove(i.product.id)}
                  className="ml-0.5 sm:ml-1 w-7 h-7 sm:w-7 sm:h-7 rounded bg-destructive/20 text-destructive grid place-items-center"
                >
                  <Trash2 className="w-2.5 h-2.5 sm:w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-border space-y-2 sm:space-y-3">
            <div className="flex justify-between font-display text-xl sm:text-2xl">
              <span>Итого</span>
              <span className="text-primary text-glow-pink">{total.toFixed(2)} BYN</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full bg-primary text-primary-foreground font-black uppercase tracking-widest py-2.5 sm:py-3 rounded-xl glow-pink text-sm sm:text-base"
            >
              Оформить заказ
            </button>
            <button
              onClick={clear}
              className="w-full text-[10px] sm:text-xs text-muted-foreground underline"
            >
              Очистить корзину
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CheckoutSheet({
  onClose,
  meetingTimes,
  onOrderPlaced,
}: {
  onClose: () => void;
  meetingTimes: string[];
  onOrderPlaced?: (items: CartItem[]) => void;
}) {
  const { items, total, clear } = useCart();
  const submit = useServerFn(createOrder);
  const [telegram, setTelegram] = useState("");
  const [change, setChange] = useState("");
  const [meetingTime, setMeetingTime] = useState<string>(meetingTimes[0] || "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { id: string }>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!telegram.trim()) {
      toast.error("Укажи юзернейм Telegram");
      return;
    }
    if (items.length === 0) return;
    const tg = telegram.trim().replace(/^@+/, "");
    if (tg.length < 3) {
      toast.error("Юзернейм слишком короткий");
      return;
    }
    const currentItems = [...items];
    setLoading(true);
    try {
      const noteParts = [`Сдача: ${change.trim() ? change.trim() : "не нужна"}`];
      const res = await submit({
        data: {
          customer_name: `@${tg}`,
          customer_phone: "Telegram",
          customer_address: meetingTime,
          customer_note: noteParts.join(" · "),
          items: currentItems.map((i) => ({
            id: i.product.id,
            name: i.product.name,
            price: i.product.price,
            qty: i.qty,
            flavor: i.product.flavor || null,
          })),
          total_amount: total,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      setDone({ id: res.id });
      clear();
      onOrderPlaced?.(currentItems);
    } catch (err) {
      console.error(err);
      toast.error("Не удалось отправить заказ. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col">
      <div className="mt-auto bg-card rounded-t-3xl border-t-2 border-secondary max-h-[92vh] flex flex-col">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 border-b border-border">
          <h3 className="font-display text-2xl truncate">{done ? "Заказ принят" : "Оформление"}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-muted grid place-items-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center flex-1 overflow-y-auto">
            <div className="w-16 h-16 text-primary mx-auto flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-16 h-16">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h4 className="font-display text-3xl mt-3 text-glow-pink text-primary">Готово!</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Номер заказа <span className="font-mono text-foreground">#{done.id.slice(0, 8)}</span>
              . Мы напишем тебе в Telegram в ближайшее время.
            </p>
            <button
              onClick={onClose}
              className="mt-6 bg-primary text-primary-foreground font-black uppercase tracking-widest px-6 py-3 rounded-xl glow-soft"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Юзернейм Telegram
              </span>
              <input
                id="telegram"
                name="telegram"
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                className="mt-1 w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Нужна ли сдача?
              </span>
              <textarea
                id="change"
                name="change"
                value={change}
                onChange={(e) => setChange(e.target.value)}
                placeholder="Например: сдача с 50"
                rows={2}
                className="mt-1 w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm resize-none"
              />
            </label>

            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Время встречи
            </div>
            <div className="grid grid-cols-2 gap-2">
              {meetingTimes.map((t) => {
                const active = meetingTime === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setMeetingTime(t)}
                    className={`text-left text-xs font-semibold px-3 py-2.5 rounded-xl border transition-all ${
                      active
                        ? "bg-primary text-primary-foreground border-primary glow-pink"
                        : "bg-background text-foreground border-border hover:border-primary/60"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="bg-background rounded-xl p-3 border border-border">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Заказ
              </div>
              {items.map((i) => (
                <div key={i.product.id} className="flex justify-between text-sm py-0.5">
                  <span className="truncate mr-2">
                    {i.product.brand} — {i.product.name}
                    {i.product.flavor ? `, ${i.product.flavor}` : ""} × {i.qty}
                  </span>
                  <span className="font-bold shrink-0">{(i.product.price * i.qty).toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-border flex justify-between font-display text-xl">
                <span>Итого</span>
                <span className="text-primary">{total.toFixed(2)} BYN</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-black uppercase tracking-widest py-3 rounded-xl glow-pink disabled:opacity-60"
            >
              {loading ? "Отправляем..." : "Подтвердить заказ"}
            </button>
            <p className="text-[10px] text-center text-muted-foreground">
              Нажимая кнопку, вы подтверждаете возраст 18+ и согласие на обработку данных.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
