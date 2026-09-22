'use client';
import { useEffect, useRef } from 'react';

const COLORS = ['--accent', '--spell', '--trap', '--extra', '--monster'];

/** Pluie de confettis (victoire), sur un canvas posé au-dessus du terrain. */
export function Confetti({ count = 160, duration = 3200 }: { count?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const style = getComputedStyle(canvas);
    const palette = COLORS.map((c) => style.getPropertyValue(c).trim() || 'gold');
    const pieces = Array.from({ length: count }, (_, i) => ({
      x: width / 2 + (Math.random() - 0.5) * 80,
      y: height * 0.55,
      vx: (Math.random() - 0.5) * 14,
      vy: -8 - Math.random() * 12,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      color: palette[i % palette.length]!,
    }));
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = now - t0;
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - duration * 0.6) / (duration * 0.4));
      for (const p of pieces) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [count, duration]);

  return (
    <canvas ref={ref} className="pointer-events-none absolute inset-0 z-40 size-full" aria-hidden />
  );
}
