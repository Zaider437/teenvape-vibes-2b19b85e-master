import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAnimationSettings } from "@/lib/admin.functions";

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
  tumblePhase: number;
  tumbleSpeed: number;
  spinSpeed: number;
  tiltPhase: number;
  tiltSpeed: number;
  flutterPhase: number;
  flutterSpeed: number;
  flutterAmp: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
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
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  opacity: number
) {
  const s = size;
  const seed = size * 100 + color.charCodeAt(1);

  ctx.save();
  ctx.globalAlpha = opacity;

  ctx.translate(0, 0);
  ctx.rotate(rotationZ);
  ctx.scale(1, Math.cos(rotationX) * 0.85 + 0.15);

  const segments = 24;
  ctx.beginPath();
  ctx.moveTo(s * 0.05, s * 0.42);

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

  const varGrad = ctx.createRadialGradient(
    cx + Math.sin(seed) * s * 0.1,
    cy + Math.cos(seed) * s * 0.1,
    0,
    cx,
    cy,
    radius
  );
  varGrad.addColorStop(0, 'rgba(255,255,255,0)');
  varGrad.addColorStop(0.3, 'rgba(255,255,255,0.06)');
  varGrad.addColorStop(0.6, 'rgba(0,0,0,0.04)');
  varGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = varGrad;
  ctx.fillRect(-s * 0.5, -s * 0.5, s, s);

  const edgeGrad = ctx.createRadialGradient(cx, cy, s * 0.08, cx, cy, radius);
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(0.85, 'rgba(0,0,0,0.15)');
  edgeGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(-s * 0.5, -s * 0.5, s, s);

  drawVeinBranch(ctx, cx, cy + s * 0.35, 0, -s * 0.7, s * 0.03, seed, opacity, 0, s);

  const highlightGrad = ctx.createRadialGradient(-s * 0.05, -s * 0.1, 0, cx, cy, s * 0.35);
  highlightGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
  highlightGrad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlightGrad;
  ctx.fillRect(-s * 0.5, -s * 0.5, s, s);

  ctx.restore();
}

function drawVeinBranch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  seed: number,
  opacity: number,
  depth: number,
  leafSize: number
) {
  if (length < leafSize * 0.02 || depth > 3) return;

  const endX = x + Math.cos(angle) * length;
  const endY = y + Math.sin(angle) * length;

  ctx.beginPath();
  ctx.moveTo(x, y);
  const ctrlX = x + Math.cos(angle) * length * 0.5 + Math.sin(angle + 0.5) * length * 0.1;
  const ctrlY = y + Math.sin(angle) * length * 0.5 + Math.cos(angle + 0.5) * length * 0.1;
  ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
  ctx.strokeStyle = `rgba(0,0,0,${(0.2 - depth * 0.05) * opacity})`;
  ctx.lineWidth = Math.max(0.3, width);
  ctx.lineCap = 'round';
  ctx.stroke();

  const branchCount = depth === 0 ? 5 : (depth === 1 ? 3 : 2);
  for (let i = 0; i < branchCount; i++) {
    const t = (i + 1) / (branchCount + 1);
    const bx = x + Math.cos(angle) * length * t;
    const by = y + Math.sin(angle) * length * t;
    const branchAngle = angle + (i % 2 === 0 ? 0.4 : -0.4) + (fbmNoise(bx * 0.1 + seed, by * 0.1 + seed, seed + depth * 50 + i, 2) - 0.5) * 0.3;
    const branchLen = length * (0.3 + fbmNoise(bx * 0.2 + seed + 1, by * 0.2 + seed + 1, seed + depth * 50 + i + 100, 2) * 0.3);
    const branchWidth = width * (0.6 - depth * 0.15);
    drawVeinBranch(ctx, bx, by, branchAngle, branchLen, branchWidth, seed, opacity, depth + 1, leafSize);
  }
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
          tumblePhase: Math.random() * Math.PI * 2,
          tumbleSpeed: 0.003 + Math.random() * 0.008,
          spinSpeed: (Math.random() - 0.5) * 0.02,
          tiltPhase: Math.random() * Math.PI * 2,
          tiltSpeed: 0.001 + Math.random() * 0.003,
          flutterPhase: Math.random() * Math.PI * 2,
          flutterSpeed: 0.005 + Math.random() * 0.01,
          flutterAmp: 0.3 + Math.random() * 0.7,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
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
        tumblePhase: 0,
        tumbleSpeed: 0,
        spinSpeed: 0,
        tiltPhase: 0,
        tiltSpeed: 0,
        flutterPhase: 0,
        flutterSpeed: 0,
        flutterAmp: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
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

          const flutter = Math.sin(t * p.flutterSpeed + p.flutterPhase) * p.flutterAmp * 0.3;
          p.speedY += flutter * 0.01;

          p.speedY = Math.max(0.2, Math.min(p.speedY, 2.5));

          const sway =
            Math.sin(timestamp * p.swaySpeed + p.swayPhase) * 0.8 * p.windInfluence;
          const windDrift = wind * p.windInfluence * 0.6;
          const noiseDrift =
            fbmNoise(p.x * 0.003 + t, p.y * 0.003 + t, p.seed, 2) * 0.4 - 0.2;
          p.x += p.speedX + sway + windDrift + noiseDrift;

          p.wobble += p.wobbleSpeed;
          p.tumblePhase += p.tumbleSpeed;
          p.tiltPhase += p.tiltSpeed;

          p.rotationX = Math.sin(p.tumblePhase) * Math.PI * 0.8;
          p.rotationY = p.spinSpeed * timestamp * 0.05 + Math.sin(p.wobble) * 0.3;
          p.rotationZ = Math.sin(p.tiltPhase) * 0.5;

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
          const perspectiveScale = 0.6 + 0.4 * (1 - p.y / screenHeight);
          const drawSize = p.size * perspectiveScale;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotationY);
          ctx.scale(
            Math.cos(p.rotationX) * (p.rotationZ > 0 ? 1 : 0.7),
            Math.cos(p.rotationX) * (p.rotationZ < 0 ? 1 : 0.7)
          );
          drawLeafShape(ctx, drawSize, p.color, p.rotationX, p.rotationY, p.rotationZ, p.opacity);
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