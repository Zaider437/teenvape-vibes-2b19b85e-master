import React, { useCallback, useEffect, useState } from "react";
import logoImg from "@/assets/5363874353084309359.jpg";

/**
 * Качающаяся на верёвке лампочка-персонаж под кнопкой «Связь с нами».
 * Персонаж = колба с логотипом LV (картинка) + ручки/ножки-палочки.
 * Клик — лампа загорается розовым (цвет буквы L из логотипа), повторный клик — гаснет.
 * Всё с «подёргиванием» (spring jiggle) на раскачивание и переключение.
 */

const ROPE_LEN = 46; // длина верёвки, px

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export const HangingBulbContact = () => {
  const [lit, setLit] = useState(false);
  // счётчик кликов: 0 = покачиваемся вхолостую, >0 = короткий импульс-«толчок»
  const [impulse, setImpulse] = useState(0);
  const reduced = usePrefersReducedMotion();

  const toggle = useCallback(() => {
    setLit((v) => !v);
    setImpulse((n) => n + 1);
  }, []);

  const accent = "var(--primary)"; // magenta из буквы L логотипа

  const active = impulse > 0;
  const ropeStyle: React.CSSProperties = {
    width: 2,
    height: ROPE_LEN,
    background: "linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0.55))",
  };

  const bulbStyle: React.CSSProperties = {
    transformOrigin: "50% -46px", // точка подвеса — верх верёвки
    marginTop: -1,
  };

  return (
    <div className="flex flex-col items-center select-none" style={{ width: 64 }}>
      {/* верёвка растёт вниз из кнопки «Связь с нами» */}
      <span
        aria-hidden
        style={ropeStyle}
        className={`block bulb-sway${active ? " bulb-impulse" : ""}`}
        key={`rope-${impulse}`}
      />

      <button
        type="button"
        onClick={toggle}
        aria-pressed={lit}
        aria-label={lit ? "Выключить светильник" : "Включить светильник"}
        className={`relative block outline-none cursor-pointer bg-transparent border-0 p-0 bulb-sway${active ? " bulb-impulse" : ""}`}
        style={bulbStyle}
        key={`bulb-${impulse}`}
      >
        {/* свечения */}
        {lit && !reduced && (
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none bulb-halo"
            style={{
              width: 96,
              height: 96,
              background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
              opacity: 0.35,
            }}
          />
        )}

        {/* цоколь */}
        <span
          aria-hidden
          className="relative block mx-auto"
          style={{
            width: 14,
            height: 9,
            borderRadius: 3,
            background: "linear-gradient(180deg, #9aa3ad, #5b636c)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
          }}
        />
        {/* колба с мордочкой-LV */}
        <span
          className="relative block mx-auto overflow-hidden"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `2px solid ${lit ? accent : "rgba(255,255,255,0.35)"}`,
            background: lit
              ? `radial-gradient(circle at 50% 38%, #ffffff 0%, ${accent} 55%, ${accent} 100%)`
              : "radial-gradient(circle at 50% 38%, #2a2a33 0%, #14141c 60%, #0c0c12 100%)",
            boxShadow: lit
              ? `0 0 18px ${accent}, 0 0 36px ${accent}, inset 0 0 10px rgba(255,255,255,0.5)`
              : "inset 0 2px 6px rgba(255,255,255,0.06)",
            transition: "box-shadow 160ms ease, background 160ms ease, border-color 160ms ease",
          }}
        >
          {/* изображение-мордочка (логотип) */}
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center"
            style={{
              filter: lit ? "brightness(1.1) saturate(1.05)" : "brightness(0.55) saturate(0.7)",
              transition: "filter 160ms ease",
            }}
          >
            <img
              src={logoImg}
              alt=""
              draggable={false}
              style={{ width: 38, height: 38, objectFit: "cover", borderRadius: "50%" }}
            />
          </span>
        </span>

        {/* ручки-палочки */}
        <span aria-hidden className="stick stick-l absolute left-[-11px] top-[52px] block" style={{ width: 12, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.75)" }} />
        <span aria-hidden className="stick stick-r absolute right-[-11px] top-[52px] block" style={{ width: 12, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.75)" }} />
        {/* ножки-палочки */}
        <span aria-hidden className="stick stick-fl absolute left-[12px] bottom-[-9px] block" style={{ width: 2, height: 9, borderRadius: 2, background: "rgba(255,255,255,0.75)" }} />
        <span aria-hidden className="stick stick-fr absolute right-[12px] bottom-[-9px] block" style={{ width: 2, height: 9, borderRadius: 2, background: "rgba(255,255,255,0.75)" }} />
      </button>
    </div>
  );
};
