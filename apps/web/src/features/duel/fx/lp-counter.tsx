'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Points de Vie qui défilent vers leur nouvelle valeur (rouge en baisse, vert en hausse). */
export function LpCounter({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const [trend, setTrend] = useState<'down' | 'up' | null>(null);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    setTrend(value < start ? 'down' : 'up');
    const duration = Math.min(900, 250 + Math.abs(value - start) / 8);
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      const current = Math.round(start + (value - start) * eased);
      from.current = current;
      setShown(current);
      if (p < 1) frame = requestAnimationFrame(tick);
      else setTimeout(() => setTrend(null), 350);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span
      className={cn(
        'font-mono tabular-nums transition-colors',
        trend === 'down' && 'text-danger',
        trend === 'up' && 'text-success',
        !trend && value <= 1000 && value > 0 && 'fx-danger',
        className,
      )}
    >
      {shown}
    </span>
  );
}
