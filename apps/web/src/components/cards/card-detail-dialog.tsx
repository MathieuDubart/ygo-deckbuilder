'use client';
import {
  CARD_CONDITIONS,
  CARD_LANGUAGES,
  matchesPrintCode,
  parsePrintCode,
  type CardCondition,
  type CardLanguage,
} from '@ygo/shared';
import { ArrowLeft, Check, Heart, Plus } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/input';
import { useMe } from '@/lib/api/auth';
import { useCard } from '@/lib/api/cards';
import { useAddToCollection } from '@/lib/api/collection';
import { useAddToWishlist } from '@/lib/api/wishlist';
import { formatPrice } from '@/lib/utils';
import { CardInteractions } from './card-interactions';

const CONDITION_LABELS: Record<CardCondition, string> = {
  MINT: 'Mint',
  NEAR_MINT: 'Near Mint',
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  LIGHT_PLAYED: 'Light Played',
  PLAYED: 'Played',
  POOR: 'Poor',
};

/** Fiche carte : infos, éditions/prix, et actions "je l'ai" / "je la veux". */
export function CardDetailDialog({
  cardId,
  onClose,
  printCodeHint,
}: {
  cardId: number | null;
  onClose: () => void;
  /** Code tapé par l'utilisateur ("SDBE-FR001") : pré-sélectionne l'édition et la langue. */
  printCodeHint?: string;
}) {
  // Navigation entre fiches depuis les interactions (historique propre à la fiche ouverte)
  const [trail, setTrail] = useState<number[]>([]);
  useEffect(() => setTrail([]), [cardId]);
  const currentId = trail.at(-1) ?? cardId;
  const top = useRef<HTMLDivElement>(null);
  const go = (id: number) => {
    setTrail((t) => [...t, id]);
    top.current?.scrollIntoView({ block: 'start' });
  };
  const back = () => setTrail((t) => t.slice(0, -1));

  const { data: me } = useMe();
  const { data: card, isLoading } = useCard(currentId);
  // L'indice de code imprimé ne vaut que pour la carte ouverte au départ
  const hint = printCodeHint && !trail.length ? parsePrintCode(printCodeHint) : null;
  const hintedPrintId = hint
    ? card?.prints.find((p) => matchesPrintCode(p.printCode, hint))?.id
    : undefined;
  const hintedLanguage = hint ? languageFromCode(printCodeHint!) : undefined;

  return (
    <Dialog open={cardId !== null} onClose={onClose} title={card?.name ?? 'Carte'} variant="sheet">
      {isLoading || !card ? (
        <div className="space-y-4">
          <Skeleton className="mx-auto aspect-(--aspect-card) w-56" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div ref={top} className="scroll-mt-20 space-y-6">
          {trail.length > 0 && (
            <button
              type="button"
              onClick={back}
              className="-mt-2 flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
            >
              <ArrowLeft className="size-4" /> Retour
            </button>
          )}
          <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
            <div className="relative mx-auto aspect-(--aspect-card) w-48 overflow-hidden rounded-[4%/3%] bg-bg-sunken">
              {card.imageUrl && (
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  sizes="192px"
                  quality={90}
                  className="object-cover"
                />
              )}
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <Badge>{card.type}</Badge>
                {card.attribute && <Badge>{card.attribute}</Badge>}
                {card.race && <Badge>{card.race}</Badge>}
                {card.archetype && <Badge tone="accent">{card.archetype}</Badge>}
                {card.banTcg && <Badge tone="danger">TCG : {card.banTcg}</Badge>}
              </div>
              {card.category === 'MONSTER' && (
                <p className="font-mono text-fg-muted tabular-nums">
                  {card.linkVal
                    ? `LINK-${card.linkVal}`
                    : card.level !== null
                      ? `Niv. ${card.level}`
                      : ''}
                  {card.scale !== null && ` · Échelle ${card.scale}`}
                  {' · '}ATK {card.atk ?? '?'}
                  {!card.linkVal && ` / DEF ${card.def ?? '?'}`}
                </p>
              )}
              <p className="leading-relaxed whitespace-pre-line text-fg-muted">{card.desc}</p>
              <p className="text-fg-subtle">
                Possédées : <strong className="text-fg">{card.ownedQuantity ?? 0}</strong> ·
                Cardmarket dès{' '}
                <strong className="text-fg">{formatPrice(card.priceCardmarket)}</strong>
              </p>
            </div>
          </div>

          <AddToCollectionForm
            key={`c-${card.id}`}
            cardId={card.id}
            prints={card.prints}
            defaultPrintId={hintedPrintId}
            defaultLanguage={hintedLanguage}
          />
          <AddToWishlistForm key={`w-${card.id}`} cardId={card.id} prints={card.prints} />

          <CardInteractions key={`i-${card.id}`} cardId={card.id} onOpen={go} signedIn={!!me} />

          {card.prints.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
                Éditions ({card.prints.length})
              </h3>
              <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                {card.prints.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate">{p.setName}</p>
                      <p className="font-mono text-xs text-fg-subtle">
                        {p.printCode} · {p.rarity}
                      </p>
                    </div>
                    <span className="font-mono text-xs tabular-nums">{formatPrice(p.price)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}

type Prints = NonNullable<ReturnType<typeof useCard>['data']>['prints'];

function PrintSelect({
  prints,
  value,
  onChange,
}: {
  prints: Prints;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Édition non précisée</option>
      {prints.map((p) => (
        <option key={p.id} value={p.id}>
          {p.printCode} — {p.rarity} ({p.setName})
        </option>
      ))}
    </Select>
  );
}

/** "SDBE-FR001" → FR ; "LOB-EN001" → EN ; sinon rien. */
function languageFromCode(code: string): CardLanguage | undefined {
  const region = /-([a-z]{2})\d/i.exec(code)?.[1]?.toUpperCase();
  return CARD_LANGUAGES.find((l) => l === region);
}

function AddToCollectionForm({
  cardId,
  prints,
  defaultPrintId,
  defaultLanguage,
}: {
  cardId: number;
  prints: Prints;
  defaultPrintId?: string;
  defaultLanguage?: CardLanguage;
}) {
  const add = useAddToCollection();
  const [printId, setPrintId] = useState(defaultPrintId ?? '');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>('NEAR_MINT');
  const [language, setLanguage] = useState<CardLanguage>(defaultLanguage ?? 'FR');
  const [firstEdition, setFirstEdition] = useState(false);
  const [added, setAdded] = useState(0);

  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-bg-sunken/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(
          { cardId, printId: printId || undefined, quantity, condition, language, firstEdition },
          { onSuccess: () => setAdded((n) => n + quantity) },
        );
      }}
    >
      <h3 className="text-sm font-semibold">Ajouter à ma collection</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Édition" className="col-span-2 sm:col-span-4">
          <PrintSelect prints={prints} value={printId} onChange={setPrintId} />
        </Field>
        <Field label="Qté">
          <Input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(+e.target.value)}
          />
        </Field>
        <Field label="État">
          <Select value={condition} onChange={(e) => setCondition(e.target.value as CardCondition)}>
            {CARD_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Langue">
          <Select value={language} onChange={(e) => setLanguage(e.target.value as CardLanguage)}>
            {CARD_LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <label className="flex items-end gap-2 pb-2.5 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={firstEdition}
            onChange={(e) => setFirstEdition(e.target.checked)}
          />
          1ère éd.
        </label>
      </div>
      <Button type="submit" loading={add.isPending} className="w-full">
        <Plus className="size-4" /> Ajouter
      </Button>
      <FormStatus
        error={add.error?.message}
        success={added > 0 ? `${added} exemplaire(s) ajouté(s) à ta collection` : undefined}
      />
    </form>
  );
}

function AddToWishlistForm({ cardId, prints }: { cardId: number; prints: Prints }) {
  const add = useAddToWishlist();
  const [open, setOpen] = useState(false);
  const [printId, setPrintId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [maxPrice, setMaxPrice] = useState('');
  const [done, setDone] = useState(false);

  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
          <Heart className="size-4" /> Ajouter à la wishlist
        </Button>
        <FormStatus success={done ? 'Ajoutée à ta wishlist' : undefined} />
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(
          {
            cardId,
            printId: printId || undefined,
            quantity,
            maxPrice: maxPrice ? +maxPrice : undefined,
          },
          {
            onSuccess: () => {
              setOpen(false);
              setDone(true);
            },
          },
        );
      }}
    >
      <h3 className="text-sm font-semibold">Je la cherche</h3>
      <Field label="Édition visée">
        <PrintSelect prints={prints} value={printId} onChange={setPrintId} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Qté">
          <Input
            type="number"
            min={1}
            max={3}
            value={quantity}
            onChange={(e) => setQuantity(+e.target.value)}
          />
        </Field>
        <Field label="Budget max (€)">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button type="submit" loading={add.isPending} className="flex-1">
          <Heart className="size-4" /> Ajouter
        </Button>
      </div>
      <FormStatus error={add.error?.message} />
    </form>
  );
}

/**
 * Retour inline dans les formulaires de la fiche : les toasts sont rendus sous
 * une <dialog> modale (top layer) et donc invisibles tant qu'elle est ouverte.
 */
function FormStatus({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm text-success">
        <Check className="size-4" /> {success}
      </p>
    );
  }
  return null;
}
