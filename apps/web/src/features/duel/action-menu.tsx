'use client';
import type { DuelActionDto } from '@ygo/shared';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Libellé d'une action (Activer l'effet X, Attaque directe…). */
export function useActionLabel() {
  const t = useTranslations('duel.actions');
  return (a: DuelActionDto) => {
    if (a.kind === 'ATTACK' && a.direct) return t('ATTACK_DIRECT');
    return t(a.kind);
  };
}

/**
 * Menu contextuel d'une carte : ses actions possibles + « Voir la carte ».
 * Positionné sous la carte cliquée, recadré dans l'écran ; Échap ou clic à côté = fermer.
 */
export function ActionMenu({
  anchor,
  actions,
  onAction,
  onInspect,
  onClose,
}: {
  anchor: HTMLElement;
  actions: DuelActionDto[];
  onAction: (a: DuelActionDto) => void;
  onInspect: (() => void) | null;
  onClose: () => void;
}) {
  const t = useTranslations('duel.actions');
  const label = useActionLabel();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const a = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const margin = 8;
    let top = a.bottom + 6;
    if (top + m.height > window.innerHeight - margin) top = Math.max(margin, a.top - m.height - 6);
    const left = Math.min(
      Math.max(margin, a.left + a.width / 2 - m.width / 2),
      window.innerWidth - m.width - margin,
    );
    setPos({ top, left });
  }, [anchor, actions.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onScroll);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={pos ?? { top: -9999, left: -9999 }}
      className="fixed z-50 flex w-64 max-w-[calc(100vw-1rem)] flex-col gap-0.5 rounded-xl border border-border-strong bg-bg-elevated p-1.5 shadow-2xl"
    >
      {actions.map((a) => (
        <button
          key={`${a.kind}-${a.index}`}
          role="menuitem"
          onClick={() => onAction(a)}
          className={cn(
            'flex flex-col items-start rounded-lg px-3 py-2 text-left text-sm hover:bg-accent/15',
            a.kind === 'ACTIVATE' && 'text-spell',
            a.kind === 'ATTACK' && 'text-danger',
          )}
        >
          <span className="font-medium">{label(a)}</span>
          {a.description && (
            <span className="line-clamp-3 text-xs text-fg-muted">{a.description}</span>
          )}
        </button>
      ))}
      {onInspect && (
        <button
          role="menuitem"
          onClick={onInspect}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg-muted hover:bg-bg-sunken hover:text-fg"
        >
          <Eye className="size-4" /> {t('inspect')}
        </button>
      )}
    </div>
  );
}
