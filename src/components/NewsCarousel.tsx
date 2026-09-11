import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getNews } from "@/lib/admin.functions";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ImageOff } from "lucide-react";

type NewsItem = {
  id: string;
  title: string;
  text: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export function NewsCarousel() {
  const getNewsFn = useServerFn(getNews);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getNewsFn()
      .then((data) => {
        if (!cancelled) setItems(data ?? []);
      })
      .catch((err) => {
        console.error("[NewsCarousel] load failed", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getNewsFn]);

  if (loading) {
    return (
      <section className="px-3 sm:px-4 mt-4 sm:mt-6">
        <div className="text-center text-sm text-muted-foreground py-6">Загружаем новости…</div>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="px-3 sm:px-4 mt-4 sm:mt-6">
      <div className="flex items-baseline justify-between mb-2 sm:mb-3">
        <h2 className="font-display text-xl sm:text-2xl text-foreground">
          Новости<span className="text-primary">.</span>
        </h2>
        <span className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
          {items.length}{" "}
          {items.length === 1 ? "новость" : items.length < 5 ? "новости" : "новостей"}
        </span>
      </div>
      <Carousel
        opts={{
          align: "start",
          loop: items.length > 1,
          dragFree: false,
          containScroll: "trimSnaps",
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 sm:-ml-4">
          {items.map((item) => (
            <CarouselItem
              key={item.id}
              className="pl-2 sm:pl-4 basis-[85%] sm:basis-[60%] md:basis-[45%] lg:basis-[38%]"
            >
              <div className="bg-card border border-border rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col h-full transition-all hover:border-primary/60 hover:-translate-y-0.5">
                <div className="aspect-video bg-primary/5 border-b border-border/60 relative overflow-hidden grid place-items-center">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageOff className="w-8 h-8 sm:w-10 sm:h-10" />
                      <span className="text-[10px] sm:text-xs font-semibold">Нет фото</span>
                    </div>
                  )}
                </div>
                <div className="p-3 sm:p-4 flex-1 flex flex-col">
                  <h3 className="font-display text-sm sm:text-base leading-snug text-foreground line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[11px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                    {item.text}
                  </p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {items.length > 1 && (
          <>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </>
        )}
      </Carousel>
    </section>
  );
}
