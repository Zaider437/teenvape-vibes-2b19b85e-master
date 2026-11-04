import { useCallback, useEffect, useState } from "react";
import type { Product } from "./products";

/**
 * Пользовательские коллекции (localStorage): избранное, сравнение,
 * недавно просмотренные. Синхронизируются между вкладками через событие.
 */

const FAV_KEY = "lv_favorites";
const CMP_KEY = "lv_compare";
const RECENT_KEY = "lv_recently_viewed";

const MAX_RECENT = 12;
const MAX_COMPARE = 4;

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("lv-collections-changed", { detail: { key } }));
  } catch {
    // storage may be unavailable
  }
}

/** Хранит и id, и снимки товара (для «недавних» без перезагрузки каталога). */
function readRecent(): { id: string; product: Product; at: number }[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function useCollection(key: string) {
  const [ids, setIds] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readIds(key),
  );

  useEffect(() => {
    const sync = () => setIds(readIds(key));
    window.addEventListener("lv-collections-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lv-collections-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  const toggle = useCallback(
    (id: string, max = Infinity): boolean => {
      const current = readIds(key);
      let next: string[];
      let added: boolean;
      if (current.includes(id)) {
        next = current.filter((x) => x !== id);
        added = false;
      } else {
        if (current.length >= max) return false;
        next = [id, ...current];
        added = true;
      }
      writeIds(key, next);
      setIds(next);
      return added;
    },
    [key],
  );

  const clear = useCallback(() => {
    writeIds(key, []);
    setIds([]);
  }, [key]);

  return { ids, toggle, clear };
}

export function useFavorites() {
  const { ids, toggle, clear } = useCollection(FAV_KEY);
  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);
  const toggleFavorite = useCallback((id: string) => toggle(id), [toggle]);
  return { favorites: ids, isFavorite, toggleFavorite, clearFavorites: clear };
}

export function useCompare() {
  const { ids, toggle, clear } = useCollection(CMP_KEY);
  const inCompare = useCallback((id: string) => ids.includes(id), [ids]);
  /** false — лимит сравнения исчерпан */
  const toggleCompare = useCallback((id: string) => toggle(id, MAX_COMPARE), [toggle]);
  return { compare: ids, inCompare, toggleCompare, clearCompare: clear };
}

export function useRecentlyViewed() {
  const [entries, setEntries] = useState(() =>
    typeof window === "undefined" ? [] : readRecent(),
  );

  useEffect(() => {
    const sync = () => setEntries(readRecent());
    window.addEventListener("lv-collections-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lv-collections-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const recordView = useCallback((product: Product) => {
    const current = readRecent().filter((e) => e.id !== product.id);
    const next = [{ id: product.id, product, at: Date.now() }, ...current].slice(0, MAX_RECENT);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("lv-collections-changed", { detail: { key: RECENT_KEY } }));
    } catch {
      // ignore
    }
    setEntries(next);
  }, []);

  const clearRecent = useCallback(() => {
    try {
      localStorage.removeItem(RECENT_KEY);
      window.dispatchEvent(new CustomEvent("lv-collections-changed", { detail: { key: RECENT_KEY } }));
    } catch {
      // ignore
    }
    setEntries([]);
  }, []);

  return { recent: entries, recordView, clearRecent };
}
