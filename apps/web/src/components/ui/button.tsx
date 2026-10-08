import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Primaire = l'étiquette : un aplat blanc os sur la page sombre, comme un bristol collé sur
 * un intercalaire. Secondaire = un simple filet. Rien n'a d'ombre portée : sur une page de
 * classeur, rien ne flotte.
 */
const variants = {
  primary: 'bg-label text-label-ink hover:brightness-95 active:brightness-90',
  secondary: 'border border-edge-strong text-ink hover:bg-ink/5 active:bg-ink/10',
  ghost: 'text-ink-muted hover:text-ink hover:bg-ink/5',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icon: 'h-9 w-9 justify-center',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center rounded-xs font-medium transition-[background-color,filter,border-color]',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
