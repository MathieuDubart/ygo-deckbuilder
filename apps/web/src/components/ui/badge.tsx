import { cn } from '@/lib/utils';

const tones = {
  neutral: 'text-ink-faint',
  accent: 'text-ink',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  gold: 'text-gold',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        // Pas de cadre ni d'aplat : un code imprimé sur la pochette, lu au besoin.
        'code inline-flex items-center gap-1 text-[11px] leading-none font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
