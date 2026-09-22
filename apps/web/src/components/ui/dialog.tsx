'use client';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Dialog basé sur <dialog> natif : focus trap, Échap et accessibilité gérés par le navigateur.
 * Variante "sheet" = panneau latéral (détail de carte), "center" = modale classique.
 */
export function Dialog({
  open,
  onClose,
  title,
  variant = 'center',
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: 'center' | 'sheet';
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations('common.actions');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cn(
        'bg-bg-elevated text-fg border border-border p-0 shadow-2xl backdrop:bg-black/60',
        variant === 'center' && 'm-auto w-[min(92vw,32rem)] rounded-2xl',
        variant === 'sheet' &&
          'my-0 mr-0 ml-auto h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-none rounded-l-2xl',
        className,
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-fg-muted hover:bg-bg-sunken hover:text-fg"
              aria-label={t('close')}
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
