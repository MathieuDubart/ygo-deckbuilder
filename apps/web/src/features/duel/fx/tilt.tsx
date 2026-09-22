'use client';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Carte qui s'incline vers le pointeur, avec un reflet (souris et stylet seulement). */
export function Tilt({
  children,
  className,
  max = 14,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
    ref.current.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
    ref.current.style.setProperty('--sx', `${((x + 0.5) * 100).toFixed(1)}%`);
    ref.current.style.setProperty('--sy', `${((y + 0.5) * 100).toFixed(1)}%`);
    ref.current.style.setProperty('--shine', '1');
  };
  const leave = () => {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
    ref.current?.style.setProperty('--shine', '0');
  };
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      className={cn('relative [perspective:500px]', className)}
    >
      <div className="relative transition-transform duration-150 ease-out [transform:rotateX(var(--rx,0))_rotateY(var(--ry,0))] [transform-style:preserve-3d]">
        {children}
        <div
          className="pointer-events-none absolute inset-0 rounded-[4%/3%] opacity-[var(--shine,0)] mix-blend-soft-light transition-opacity"
          style={{
            background:
              'radial-gradient(circle at var(--sx,50%) var(--sy,50%), rgba(255,255,255,0.75), transparent 55%)',
          }}
        />
      </div>
    </div>
  );
}
