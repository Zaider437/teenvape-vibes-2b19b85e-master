import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAnimationSettings } from "@/lib/admin.functions";

let leafTextureImage: HTMLImageElement | null = null;
let leafTextureLoading = false;

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
      leafTextureLoading = false;
      resolve(img);
    };
    img.onerror = () => {
      leafTextureLoading = false;
      resolve(null);
    };
    img.src = "/assets/images/Osenniy-list-klena.png";
  });
}

interface SnowParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
}

interface LeafInstance {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
  swayPhase: number;
  swaySpeed: number;
  windInfluence: number;
  opacity: number;
  fadeIn: boolean;
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

export function FallingEffects({ onSnowChange }: FallingEffectsProps) {
  const getAnim = useServerFn(getAnimationSettings);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeEffects, setActiveEffects] = useState<{ snow: boolean; leaves: boolean }>({
    snow: false,
    leaves: false,
  });
  const [leafTexture, setLeafTexture] = useState<HTMLImageElement | null>(null);
  const [snowCount, setSnowCount] = useState(40);
  const [leavesCount, setLeavesCount] = useState(30);

  useEffect(() => {
    loadLeafTexture().then((img) => {
      if (img) setLeafTexture(img);
    });
  }, []);

  const isMobile = useIsMobile();

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
        setSnowCount(settings.snow.count ?? 40);
        setLeavesCount(settings.leaves.count ?? 30);
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

    const snowParticles: SnowParticle[] = [];
    const leafInstances: LeafInstance[] = [];

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

    const maxSnow = snowCount;
    const maxLeaves = leavesCount;

    for (let i = 0; i < maxSnow; i++) {
      snowParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 3 + 1,
        speedY: Math.random() * 1 + 0.5,
        speedX: Math.random() * 1 - 0.5,
        opacity: 0.5 + Math.random() * 0.5,
      });
    }

    for (let i = 0; i < maxLeaves; i++) {
      leafInstances.push(createLeafInstance(true));
    }

    function createLeafInstance(initY = false): LeafInstance {
      return {
        x: Math.random() * window.innerWidth,
        y: initY ? Math.random() * window.innerHeight : -10,
        size: 55,
        speedY: Math.random() * 0.5 + 0.3,
        speedX: Math.random() * 0.6 - 0.3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.015,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.0004 + Math.random() * 0.0008,
        windInfluence: 0.3 + Math.random() * 0.5,
        opacity: 0,
        fadeIn: true,
      };
    }

    const animate = (timestamp: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const t = timestamp * 0.001;

      const windGustMultiplier = isMobile ? 0.3 : 1;

      const windGust =
        Math.sin(t * 0.3) * 0.3 * windGustMultiplier +
        Math.sin(t * 0.7 + 1.5) * 0.2 * windGustMultiplier +
        Math.sin(t * 1.5 + 3.0) * 0.15 * windGustMultiplier +
        Math.sin(t * 3.1 + 0.7) * 0.05 * windGustMultiplier;

      const windNoiseOctaves = isMobile ? 2 : 3;

      const windNoise =
        fbmNoise(t * 0.1, timestamp * 0.0001, 42, windNoiseOctaves) * 0.6 - 0.3;

      const wind = windGust + windNoise;

      if (activeEffects.snow) {
        snowParticles.forEach((p, idx) => {
          p.y += p.speedY;
          const snowWind = isMobile ? 0 : Math.sin(p.y / 30) * 0.2;
          p.x += p.speedX + snowWind;

          if (p.y > window.innerHeight + 10) {
            snowParticles[idx] = {
              x: Math.random() * window.innerWidth,
              y: -10,
              size: Math.random() * 3 + 1,
              speedY: Math.random() * 1 + 0.5,
              speedX: Math.random() * 1 - 0.5,
              opacity: 0.5 + Math.random() * 0.5,
            };
          }

           ctx.beginPath();
           ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
           ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
           ctx.shadowBlur = 8;
           ctx.shadowColor = `rgba(255, 255, 255, ${p.opacity * 0.6})`;
           ctx.fill();
           ctx.shadowBlur = 0;
        });
      }

      if (activeEffects.leaves && leafTexture) {
        leafInstances.forEach((leaf, idx) => {
          leaf.y += leaf.speedY;

          const gravity = 0.0003;
          leaf.speedY += gravity;
          leaf.speedY = Math.max(0.2, Math.min(leaf.speedY, 2.5));

          const swayMultiplier = isMobile ? 0.4 : 1;
          const sway =
            Math.sin(timestamp * leaf.swaySpeed + leaf.swayPhase) * 0.8 * leaf.windInfluence * swayMultiplier;
          const windDrift = wind * leaf.windInfluence * 0.6 * swayMultiplier;
          const noiseDriftOctaves = isMobile ? 1 : 2;
          const noiseDrift =
            fbmNoise(leaf.x * 0.003 + t, leaf.y * 0.003 + t, leaf.swayPhase, noiseDriftOctaves) * 0.4 - 0.2;
          leaf.x += leaf.speedX + sway + windDrift + noiseDrift;

          const rotationSpeedMultiplier = isMobile ? 0.5 : 1;
          leaf.rotation += leaf.rotationSpeed * rotationSpeedMultiplier;

          const fadeZone = isMobile ? 120 : 80;

          if (leaf.y < fadeZone && leaf.fadeIn) {
            leaf.opacity = Math.max(0, leaf.y / fadeZone);
          }
          if (leaf.y > window.innerHeight - fadeZone) {
            leaf.opacity = Math.max(0, (window.innerHeight - leaf.y) / fadeZone);
          }

           ctx.save();
           ctx.translate(leaf.x, leaf.y);
           ctx.rotate(leaf.rotation);
           ctx.globalAlpha = leaf.opacity;
           ctx.shadowBlur = 12;
           ctx.shadowColor = `rgba(255, 255, 255, ${leaf.opacity * 0.5})`;

           const texW = leafTexture.width;
           const texH = leafTexture.height;
           const aspect = texW / texH;
           let drawW = leaf.size * 0.7;
           let drawH = drawW / aspect;
           if (drawH > leaf.size * 0.9) {
             drawH = leaf.size * 0.9;
             drawW = drawH * aspect;
           }
           const offsetX = (leaf.size * 0.7 - drawW) / 2;
           const offsetY = (leaf.size * 0.9 - drawH) / 2;

           ctx.drawImage(
             leafTexture,
             -leaf.size * 0.35 + offsetX,
             -leaf.size * 0.45 + offsetY,
             drawW,
             drawH,
           );

           ctx.shadowBlur = 0;
           ctx.restore();

          if (leaf.y > window.innerHeight + 20 || leaf.x < -30 || leaf.x > window.innerWidth + 30) {
            leafInstances[idx] = createLeafInstance(false);
          }
        });
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate(0);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeEffects, leafTexture, isMobile, snowCount, leavesCount]);

  useEffect(() => {
    onSnowChange?.(activeEffects.snow);
  }, [activeEffects.snow, onSnowChange]);

  if (!activeEffects.snow && !activeEffects.leaves) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}