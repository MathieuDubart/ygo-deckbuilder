'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CardImage } from '@/components/cards/card-image';
import { useCardSearch } from '@/lib/api/cards';

/**
 * Cartes citées par une section : les noms sont stockés en anglais dans rules.json et
 * cherchés dans le catalogue, donc l'affichage reste traduit et sans code de carte figé.
 * La recherche n'est lancée que lorsque la bande entre dans le champ de vision, et une carte
 * absente du catalogue (résultat approchant ou vide) est simplement masquée.
 */
function Cited({
  name,
  enabled,
  onOpen,
  onResolved,
}: {
  name: string;
  enabled: boolean;
  onOpen: (id: number) => void;
  onResolved: (name: string, found: boolean) => void;
}) {
  const { data, isPending, isError } = useCardSearch({ q: name, pageSize: 1 }, enabled);
  // `approximate` = aucune correspondance exacte : le catalogue ne contient pas cette carte
  const card = data && !data.approximate ? data.items[0] : undefined;
  const settled = !enabled || isError || (!isPending && !!data);

  useEffect(() => {
    if (settled) onResolved(name, !!card);
  }, [settled, card, name, onResolved]);

  if (!card) {
    return enabled && !settled ? (
      <div className="aspect-(--aspect-card) w-16 shrink-0 animate-pulse rounded-[4%/3%] bg-bg-sunken" />
    ) : null;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(card.id)}
      className="group w-16 shrink-0 cursor-pointer text-left"
      title={card.name}
    >
      <CardImage
        card={card}
        sizes="80px"
        className="transition group-hover:ring-2 group-hover:ring-accent"
      />
      <span className="mt-1 block truncate text-[11px] leading-tight text-fg-subtle group-hover:text-fg">
        {card.name}
      </span>
    </button>
  );
}

export function RuleCards({
  names,
  label,
  onOpen,
}: {
  names: string[];
  label: string;
  onOpen: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [resolved, setResolved] = useState<Record<string, boolean>>({});

  const onResolved = useCallback(
    (name: string, found: boolean) =>
      setResolved((r) => (r[name] === found ? r : { ...r, [name]: found })),
    [],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  // Titre masqué tant qu'aucune carte n'a été trouvée (catalogue partiel, instance neuve…)
  const done = names.every((n) => n in resolved);
  const empty = done && names.every((n) => !resolved[n]);

  return (
    <div ref={ref} className={empty ? 'hidden' : 'mt-5'}>
      <p className="mb-2 text-xs font-medium text-fg-subtle">{label}</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {names.map((name) => (
          <Cited key={name} name={name} enabled={visible} onOpen={onOpen} onResolved={onResolved} />
        ))}
      </div>
    </div>
  );
}
