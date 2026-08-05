import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAnimationSettings } from "@/lib/admin.functions";

let leafTextureImage: HTMLImageElement | null = null;
let leafTextureLoading = false;
let leafTextureLoaded = false;

function loadLeafTexture(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (leafTextureImage) {
      resolve(leafTextureImage);
      return;
    }
    if (leafTextureLoading) {
      const check = setInterval(() => {
        if (leafTextureImage) {
          clearInterval(check);
          resolve(leafTextureImage);
        }
      }, 50);
      return;
    }
    leafTextureLoading = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      leafTextureImage = img;
      leafTextureLoaded = true;
      leafTextureLoading = false;
      resolve(img);
    };
    img.onerror = () => {
      leafTextureLoading = false;
      resolve(null);
    };
    img.src = "/assets/images/pngwing-leaf.png";
  });
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  color: string;
  type: "snow" | "leaf";
  swayPhase: number;
  swaySpeed: number;
  windInfluence: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  fadeIn: boolean;
  fadeOut: boolean;
  seed: number;
}

interface FallingEffectsProps {
  onSnowChange?: (active: boolean) => void;
}

function simpleNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.12) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = simpleNoise(ix, iy, seed);
  const b = simpleNoise(ix + 1, iy, seed);
  const c = simpleNoise(ix, iy + 1, seed);
  const d = simpleNoise(ix + 1, iy + 1, seed);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmNoise(x: number, y: number, seed: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency, seed + i * 31.7) * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return value / maxVal;
}

function drawLeafShape(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  opacity: number,
  texture: HTMLImageElement | null
) {
  const s = size;
  const seed = size * 100 + color.charCodeAt(1);

  ctx.save();
  ctx.globalAlpha = opacity;

  ctx.beginPath();
  ctx.moveTo(s * 0.05, s * 0.42);

  const segments = 24;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const maxWidth = s * 0.32;
    const minWidth = s * 0.01;
    const widthAtT = maxWidth * (1 - t) + minWidth * t;

    const nx = -s * 0.08 + t * s * 0.25;
    const ny = s * 0.42 - t * s * 0.84;

    const w1 = fbmNoise(nx * 0.1 + seed, ny * 0.1 + seed, seed, 2);
    const w2 = fbmNoise(nx * 0.15 + seed + 100, ny * 0.15 + seed + 100, seed + 100, 2);
    const edgeWobble = (w1 - 0.5) * s * 0.05 + (w2 - 0.5) * s * 0.03;

    const asym = Math.sin(t * 5.3 + seed * 0.07) * s * 0.015;

    ctx.lineTo(nx + widthAtT + edgeWobble + asym, ny);
  }

  ctx.lineTo(s * 0.17, -s * 0.42);

  for (let i = segments; i >= 1; i--) {
    const t = i / segments;
    const maxWidth = s * 0.32;
    const minWidth = s * 0.01;
    const widthAtT = maxWidth * (1 - t) + minWidth * t;

    const nx = -s * 0.08 + t * s * 0.25;
    const ny = s * 0.42 - t * s * 0.84;

    const w1 = fbmNoise(nx * 0.1 + seed + 200, ny * 0.1 + seed + 200, seed + 200, 2);
    const w2 = fbmNoise(nx * 0.15 + seed + 300, ny * 0.15 + seed + 300, seed + 300, 2);
    const edgeWobble = (w1 - 0.5) * s * 0.05 + (w2 - 0.5) * s * 0.03;

    const asym = Math.sin(t * 4.7 + seed * 0.09 + 2.0) * s * 0.015;

    ctx.lineTo(nx - widthAtT + edgeWobble + asym, ny);
  }

  ctx.closePath();
  ctx.clip();

  if (texture) {
    const texW = texture.width;
    const texH = texture.height;
    const aspect = texW / texH;
    let drawW = s * 0.7;
    let drawH = drawW / aspect;
    if (drawH > s * 0.9) {
      drawH = s * 0.9;
      drawW = drawH * aspect;
    }
    const offsetX = (s * 0.7 - drawW) / 2;
    const offsetY = (s * 0.9 - drawH) / 2;
    ctx.drawImage(texture, -s * 0.35 + offsetX, -s * 0.45 + offsetY, drawW, drawH);
  } else {
    const cx = s * 0.05;
    const cy = 0;
    const radius = s * 0.45;

    const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    baseGrad.addColorStop(0, adjustBrightness(color, 20));
    baseGrad.addColorStop(0.3, color);
    baseGrad.addColorStop(0.6, adjustBrightness(color, -5));
    baseGrad.addColorStop(0.85, adjustBrightness(color, -15));
    baseGrad.addColorStop(1, adjustBrightness(color, -30));
    ctx.fillStyle = baseGrad;
    ctx.fillRect(-s * 0.5, -s * 0.5, s, s);

    const edgeGrad = ctx.createRadialGradient(cx, cy, s * 0.08, cx, cy, radius);
    edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(0.85, 'rgba(0,0,0,0.15)');
    edgeGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
  }

  ctx.restore();
}

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

export function FallingEffects({ onSnowChange }: FallingEffectsProps) {
  const getAnim = useServerFn(getAnimationSettings);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeEffects, setActiveEffects] = useState<{ snow: boolean; leaves: boolean }>({
    snow: false,
    leaves: false,
  });
  const [leafTexture, setLeafTexture] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    loadLeafTexture().then((img) => {
      if (img) setLeafTexture(img);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    getAnim()
      .then((settings) => {
        if (cancelled || !settings) return;
        const currentMonth = new Date().getMonth() + 1;
        const isMonthInRange = (curr: number, from: number, to: number) => {
          if (from <= to) return curr >= from && curr <= to;
          return curr >= from || curr <= to;
        };
        const snowActive =
          settings.snow.enabled &&
          isMonthInRange(currentMonth, settings.snow.from, settings.snow.to);
        const leavesActive =
          settings.leaves.enabled &&
          isMonthInRange(currentMonth, settings.leaves.from, settings.leaves.to);
        setActiveEffects({ snow: snowActive, leaves: leavesActive });
      })
      .catch((err) => {
        console.error("Failed to load animation settings:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [getAnim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!activeEffects.snow && !activeEffects.leaves)) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const particles: Particle[] = [];

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const maxParticles = 60;
    const leafColors = [
      "#c0392b",
      "#d4641a",
      "#e67e22",
      "#eab676",
      "#f9c74f",
      "#90be6d",
      "#abdbe3",
      "#ee6c4d",
      "#a855f7",
      "#f97316",
      "#84cc16",
      "#d97706",
    ];

    const createParticle = (initY = false): Particle => {
      const type =
        activeEffects.snow && activeEffects.leaves
          ? Math.random() > 0.5
            ? "snow"
            : "leaf"
          : activeEffects.snow
            ? "snow"
            : "leaf";

      const x = Math.random() * window.innerWidth;
      const y = initY ? Math.random() * window.innerHeight : -10;
      const size = type === "snow" ? Math.random() * 3 + 1 : Math.random() * 35 + 20;
      const baseSpeedY = type === "snow" ? Math.random() * 1 + 0.5 : Math.random() * 0.8 + 0.4;
      const speedX = Math.random() * 1 - 0.5;
      const seed = Math.random() * 1000;

      if (type === "leaf") {
        return {
          x,
          y,
          size,
          speedY: baseSpeedY,
          speedX,
          color: leafColors[Math.floor(Math.random() * leafColors.length)],
          type,
          swayPhase: Math.random() * Math.PI * 2,
          swaySpeed: 0.0006 + Math.random() * 0.0012,
          windInfluence: 0.3 + Math.random() * 0.7,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.001 + Math.random() * 0.0025,
          opacity: 0,
          fadeIn: true,
          fadeOut: false,
          seed,
        };
      }

      return {
        x,
        y,
        size,
        speedY: baseSpeedY,
        speedX,
        color: "",
        type,
        swayPhase: 0,
        swaySpeed: 0,
        windInfluence: 0,
        wobble: 0,
        wobbleSpeed: 0,
        opacity: 0.8,
        fadeIn: false,
        fadeOut: false,
        seed: 0,
      };
    };

    for (let i = 0; i < maxParticles; i++) {
      particles.push(createParticle(true));
    }

    const animate = (timestamp: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const t = timestamp * 0.001;

      const windGust =
        Math.sin(t * 0.3) * 0.3 +
        Math.sin(t * 0.7 + 1.5) * 0.2 +
        Math.sin(t * 1.5 + 3.0) * 0.15 +
        Math.sin(t * 3.1 + 0.7) * 0.05;

      const windNoise =
        fbmNoise(t * 0.1, timestamp * 0.0001, 42, 3) * 0.6 - 0.3;

      const wind = windGust + windNoise;

      particles.forEach((p, idx) => {
        if (p.type === "leaf") {
          p.y += p.speedY;

          const gravity = 0.0003;
          p.speedY += gravity;

          p.speedY = Math.max(0.2, Math.min(p.speedY, 2.5));

          const sway =
            Math.sin(timestamp * p.swaySpeed + p.swayPhase) * 0.8 * p.windInfluence;
          const windDrift = wind * p.windInfluence * 0.6;
          const noiseDrift =
            fbmNoise(p.x * 0.003 + t, p.y * 0.003 + t, p.seed, 2) * 0.4 - 0.2;
          p.x += p.speedX + sway + windDrift + noiseDrift;

          p.wobble += p.wobbleSpeed;

          p.opacity = Math.min(1, p.opacity + 0.02);
        } else {
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(p.y / 30) * 0.2;
        }

        const screenHeight = window.innerHeight;
        const fadeZone = 80;

        if (p.type === "leaf") {
          if (p.y < fadeZone && p.fadeIn) {
            p.opacity = Math.max(0, p.y / fadeZone);
          }
          if (p.y > screenHeight - fadeZone) {
            p.opacity = Math.max(0, (screenHeight - p.y) / fadeZone);
          }
        }

        if (p.type === "snow") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + Math.sin(timestamp * 0.002 + p.x) * 0.1})`;
          ctx.fill();
        } else if (p.type === "leaf" && p.color) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.wobble) * 0.3);
          drawLeafShape(ctx, p.size, p.color, p.opacity, leafTexture);
          ctx.restore();
        }

        if (p.y > screenHeight + 20 || p.x < -30 || p.x > window.innerWidth + 30) {
          particles[idx] = createParticle(false);
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate(0);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeEffects]);

  useEffect(() => {
    onSnowChange?.(activeEffects.snow);
  }, [activeEffects.snow, onSnowChange]);

  if (!activeEffects.snow && !activeEffects.leaves) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ mixBlendMode: "screen" }}
    />
  );
}