import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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

    const maxSnow = 60;
    const maxLeaves = 30;

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
        size: Math.random() * 35 + 20,
        speedY: Math.random() * 0.8 + 0.4,
        speedX: Math.random() * 1 - 0.5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.0006 + Math.random() * 0.0012,
        windInfluence: 0.3 + Math.random() * 0.7,
        opacity: 0,
        fadeIn: true,
      };
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

      if (activeEffects.snow) {
        snowParticles.forEach((p, idx) => {
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(p.y / 30) * 0.2;

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
          ctx.fill();
        });
      }

      if (activeEffects.leaves && leafTexture) {
        leafInstances.forEach((leaf, idx) => {
          leaf.y += leaf.speedY;

          const gravity = 0.0003;
          leaf.speedY += gravity;
          leaf.speedY = Math.max(0.2, Math.min(leaf.speedY, 2.5));

          const sway =
            Math.sin(timestamp * leaf.swaySpeed + leaf.swayPhase) * 0.8 * leaf.windInfluence;
          const windDrift = wind * leaf.windInfluence * 0.6;
          const noiseDrift =
            fbmNoise(leaf.x * 0.003 + t, leaf.y * 0.003 + t, leaf.swayPhase, 2) * 0.4 - 0.2;
          leaf.x += leaf.speedX + sway + windDrift + noiseDrift;

          leaf.rotation += leaf.rotationSpeed;

          if (leaf.y < 80 && leaf.fadeIn) {
            leaf.opacity = Math.max(0, leaf.y / 80);
          }
          if (leaf.y > window.innerHeight - 80) {
            leaf.opacity = Math.max(0, (window.innerHeight - leaf.y) / 80);
          }

          ctx.save();
          ctx.translate(leaf.x, leaf.y);
          ctx.rotate(leaf.rotation);
          ctx.globalAlpha = leaf.opacity;

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
  }, [activeEffects, leafTexture]);

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