import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAnimationSettings } from "@/lib/admin.functions";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  angle: number;
  spin: number;
  color: string;
  type: "snow" | "leaf";
  swayPhase: number;
  swaySpeed: number;
  windInfluence: number;
  wobble: number;
  wobbleSpeed: number;
}

interface FallingEffectsProps {
  onSnowChange?: (active: boolean) => void;
}

function drawLeafShape(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string
) {
  const s = size;

  ctx.beginPath();
  ctx.moveTo(-s * 0.4, 0);

  ctx.bezierCurveTo(
    -s * 0.25, -s * 0.38,
    s * 0.15, -s * 0.35,
    s * 0.45, -s * 0.05
  );

  ctx.bezierCurveTo(
    s * 0.55, s * 0.05,
    s * 0.45, s * 0.2,
    s * 0.35, s * 0.35
  );

  ctx.bezierCurveTo(
    s * 0.2, s * 0.55,
    s * 0.05, s * 0.7,
    0, s * 0.8
  );

  ctx.bezierCurveTo(
    -s * 0.05, s * 0.7,
    -s * 0.2, s * 0.55,
    -s * 0.35, s * 0.35
  );

  ctx.bezierCurveTo(
    -s * 0.45, s * 0.2,
    -s * 0.55, s * 0.05,
    -s * 0.4, 0
  );

  ctx.closePath();

  const gradient = ctx.createLinearGradient(-s * 0.4, 0, s * 0.45, 0);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, adjustBrightness(color, -15));
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-s * 0.35, 0);
  ctx.lineTo(s * 0.3, s * 0.02);
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.lineCap = "round";
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    const t = 0.2 + i * 0.25;
    const vx = -s * 0.35 + t * s * 0.65;
    const vy = Math.sin(t * Math.PI) * s * 0.15;
    const branchLen = s * 0.12 * (1 - i * 0.2);

    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.quadraticCurveTo(
      vx - branchLen * 0.5,
      vy - branchLen * 0.4,
      vx - branchLen * 0.8,
      vy - branchLen * 0.7
    );
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = Math.max(0.5, s * 0.01);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.quadraticCurveTo(
      vx + branchLen * 0.5,
      vy - branchLen * 0.4,
      vx + branchLen * 0.8,
      vy - branchLen * 0.7
    );
    ctx.stroke();
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
    const leafColors = ["#e28743", "#eab676", "#abdbe3", "#ee6c4d", "#f9c74f", "#90be6d"];

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
      const size = type === "snow" ? Math.random() * 3 + 1 : Math.random() * 8 + 6;
      const speedY = type === "snow" ? Math.random() * 1 + 0.5 : Math.random() * 1.2 + 0.8;
      const speedX = Math.random() * 1 - 0.5;

      if (type === "leaf") {
        return {
          x,
          y,
          size,
          speedY,
          speedX,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.015,
          color: leafColors[Math.floor(Math.random() * leafColors.length)],
          type,
          swayPhase: Math.random() * Math.PI * 2,
          swaySpeed: 0.0008 + Math.random() * 0.0015,
          windInfluence: 0.3 + Math.random() * 0.7,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.002 + Math.random() * 0.003,
        };
      }

      return {
        x,
        y,
        size,
        speedY,
        speedX,
        angle: 0,
        spin: 0,
        color: "",
        type,
        swayPhase: 0,
        swaySpeed: 0,
        windInfluence: 0,
        wobble: 0,
        wobbleSpeed: 0,
      };
    };

    for (let i = 0; i < maxParticles; i++) {
      particles.push(createParticle(true));
    }

    const animate = (timestamp: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const wind =
        Math.sin(timestamp * 0.0003) * 0.4 +
        Math.sin(timestamp * 0.0007 + 1.5) * 0.2 +
        Math.sin(timestamp * 0.0015 + 3.0) * 0.1;

      particles.forEach((p, idx) => {
        p.y += p.speedY;

        if (p.type === "leaf") {
          const sway =
            Math.sin(timestamp * p.swaySpeed + p.swayPhase) * 0.6 * p.windInfluence;
          const windDrift = wind * p.windInfluence * 0.5;
          p.x += p.speedX + sway + windDrift;

          p.wobble += p.wobbleSpeed;
          p.angle += p.spin + Math.sin(p.wobble) * 0.015 * p.windInfluence;
        } else {
          p.x += p.speedX + Math.sin(p.y / 30) * 0.2;
        }

        if (p.type === "snow") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fill();
        } else if (p.type === "leaf" && p.color && p.angle !== undefined) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          drawLeafShape(ctx, p.size, p.color);
          ctx.restore();
        }

        if (p.y > window.innerHeight + 10 || p.x < -10 || p.x > window.innerWidth + 10) {
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