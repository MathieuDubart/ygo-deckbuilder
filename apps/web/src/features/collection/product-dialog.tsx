'use client';
import { maxCopiesFor, type OwnedProductCardDto, type OwnedProductDetailDto } from '@ygo/shared';
import { BookOpen, Check, ClipboardCopy, ListChecks, Trash2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { CardImage } from '@/components/cards/card-image';
import { ProductCover } from '@/components/products/product-cover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { DeckGuide } from '@/features/guide/deck-guide';
import { useOwnedProduct, useRemoveProduct } from '@/lib/api/collection';
import { useCreateDeck } from '@/lib/api/decks';
import { cn } from '@/lib/utils';
import { KIND_LABEL } from './products-tab';

type Tab = 'content' | 'guide';

const GROUPS: { label: string; match: (c: OwnedProductCardDto) => boolean }[] = [
  { label: 'Monstres', match: (c) => c.zone === 'MAIN' && c.card.category === 'MONSTER' },
  { label: 'Magies', match: (c) => c.zone === 'MAIN' && c.card.category === 'SPELL' },
  { label: 'Pièges', match: (c) => c.zone === 'MAIN' && c.card.category === 'TRAP' },
  { label: 'Extra Deck', match: (c) => c.zone === 'EXTRA' },
  {
    label: 'Autres',
    match: (c) => c.zone === 'MAIN' && !['MONSTER', 'SPELL', 'TRAP'].includes(c.card.category),
  },
];

/**
 * Fiche d'un produit de la collection : son contenu (pour le reconstituer), ce qui manque
 * dans la collection, et — pour les decks — le guide de jeu et la création d'un deck.
 */
export function ProductDialog({
  productId,
  onClose,
}: {
  productId: string | null;
  onClose: () => void;
}) {
  const { data: product, isLoading, error } = useOwnedProduct(productId);
  const [tab, setTab] = useState<Tab>('content');
  const [inspect, setInspect] = useState<number | null>(null);

  function close() {
    setTab('content');
    onClose();
  }

  return (
    <>
      <Dialog
        open={productId !== null}
        onClose={close}
        title={product?.set.name ?? 'Produit'}
        variant="sheet"
        className="w-[min(100vw,46rem)]"
      >
        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error.message}</p>
        ) : isLoading || !product ? (
          <div className="space-y-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="space-y-5">
            <Header product={product} onDone={close} />

            {product.isDeck && (
              <div
                role="tablist"
                className="grid grid-cols-2 rounded-lg border border-border bg-bg-sunken p-0.5 text-sm"
              >
                {(
                  [
                    ['content', 'Contenu', ListChecks],
                    ['guide', 'Comment le jouer', BookOpen],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition',
                      tab === value ? 'bg-bg-elevated shadow-sm' : 'text-fg-muted hover:text-fg',
                    )}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
            )}

            {tab === 'guide' && product.isDeck ? (
              <ProductGuide product={product} onInspect={setInspect} />
            ) : (
              <Content product={product} onInspect={setInspect} />
            )}
          </div>
        )}
      </Dialog>
      <CardDetailDialog cardId={inspect} onClose={() => setInspect(null)} />
    </>
  );
}

function Header({ product: p, onDone }: { product: OwnedProductDetailDto; onDone: () => void }) {
  const router = useRouter();
  const createDeck = useCreateDeck();
  const remove = useRemoveProduct();
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeCards, setRemoveCards] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const complete = p.completeness >= 1;

  async function copyList() {
    try {
      await navigator.clipboard.writeText(listAsText(p));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Copie impossible (le navigateur l’a refusée).');
    }
  }

  async function createFromProduct() {
    setActionError(null);
    try {
      const deck = await createDeck.mutateAsync({
        name: p.set.name.slice(0, 80),
        format: 'TCG',
        cards: deckCards(p),
      });
      onDone();
      router.push(`/decks/${deck.id}`);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <ProductCover set={p.set} sizes="144px" className="mx-auto aspect-[3/4] w-36 sm:w-full" />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="font-mono text-xs text-fg-subtle">
            {KIND_LABEL[p.set.kind]} · {p.set.code ?? '—'}
            {p.set.tcgDate && ` · ${p.set.tcgDate.slice(0, 4)}`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="accent">
              {p.copies} produit{p.copies > 1 ? 's' : ''} · {p.language}
            </Badge>
            <Badge>
              {p.totalCards} cartes · {p.distinctCards} différentes
            </Badge>
            {p.quantitiesVerified ? (
              <Badge tone="success">
                <Check className="size-3" /> Quantités officielles
              </Badge>
            ) : (
              <span title="Liste officielle introuvable : 1 exemplaire compté par carte">
                <Badge tone="warning">Quantités non vérifiées</Badge>
              </span>
            )}
          </div>
          <p className="text-fg-subtle">
            Ajouté le {new Date(p.addedAt).toLocaleDateString('fr-FR')}
          </p>
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-bg-sunken">
              <div
                className={cn('h-full rounded-full', complete ? 'bg-success' : 'bg-warning')}
                style={{ width: `${Math.round(p.completeness * 100)}%` }}
              />
            </div>
            <p className={cn('text-xs', complete ? 'text-success' : 'text-warning')}>
              {complete
                ? 'Toutes ses cartes sont dans ta collection.'
                : `${p.missingCopies} exemplaire(s) ne sont plus dans ta collection (vendus, échangés, mal saisis…).`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {p.isDeck && (
          <Button size="sm" onClick={createFromProduct} loading={createDeck.isPending}>
            <Wand2 className="size-4" /> Créer un deck avec
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={copyList}>
          {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
          {copied ? 'Liste copiée' : 'Copier la liste'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => setConfirmRemove((v) => !v)}
        >
          <Trash2 className="size-4" /> Retirer
        </Button>
      </div>

      {confirmRemove && (
        <div className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
          <p>Retirer « {p.set.name} » de tes produits ?</p>
          <label className="flex items-start gap-2 text-fg-muted">
            <input
              type="checkbox"
              className="mt-1"
              checked={removeCards}
              onChange={(e) => setRemoveCards(e.target.checked)}
            />
            <span>
              Retirer aussi ses {p.totalCards * p.copies} cartes de ma collection (sinon elles
              restent, seul le produit disparaît de la liste)
            </span>
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { id: p.id, removeCards },
                  { onSuccess: onDone, onError: (e) => setActionError(e.message) },
                )
              }
            >
              <Trash2 className="size-4" /> Retirer
            </Button>
          </div>
        </div>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      )}
    </div>
  );
}

function Content({
  product: p,
  onInspect,
}: {
  product: OwnedProductDetailDto;
  onInspect: (id: number) => void;
}) {
  const [missingOnly, setMissingOnly] = useState(false);
  const cards = missingOnly ? p.cards.filter((c) => c.owned < c.needed) : p.cards;
  const missing = p.cards.filter((c) => c.owned < c.needed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-fg-muted">
          {p.copies > 1
            ? `Quantités pour ${p.copies} produits.`
            : 'Tout le contenu du produit, avec ce que tu as encore.'}
        </p>
        {missing > 0 && (
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
            />
            Seulement ce qui manque ({missing})
          </label>
        )}
      </div>

      {GROUPS.map(({ label, match }) => {
        const group = cards.filter(match);
        if (!group.length) return null;
        return (
          <section key={label}>
            <h3 className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
              {label}
              <span className="font-mono text-xs font-normal text-fg-subtle tabular-nums">
                {group.reduce((s, c) => s + c.needed, 0)}
              </span>
            </h3>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {group.map((c) => (
                <ContentRow key={c.card.id} entry={c} onInspect={onInspect} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ContentRow({
  entry: c,
  onInspect,
}: {
  entry: OwnedProductCardDto;
  onInspect: (id: number) => void;
}) {
  const ok = c.owned >= c.needed;
  return (
    <li>
      <button
        type="button"
        onClick={() => onInspect(c.card.id)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-bg-sunken/60"
      >
        <CardImage card={c.card} sizes="36px" className="w-9 shrink-0" />
        <span className="w-7 shrink-0 font-mono text-sm font-semibold tabular-nums">
          ×{c.needed}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{c.card.name}</span>
          <span className="block font-mono text-[11px] text-fg-subtle">
            {c.printCode} · {c.rarity}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
            ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
          )}
          title={`${c.owned} possédé(s) sur ${c.needed}`}
        >
          {ok ? <Check className="inline size-3" /> : `${c.owned}/${c.needed}`}
        </span>
      </button>
    </li>
  );
}

/** Guide du deck tel qu'il sort de la boîte (1 produit, 3 exemplaires max par carte). */
function ProductGuide({
  product: p,
  onInspect,
}: {
  product: OwnedProductDetailDto;
  onInspect: (id: number) => void;
}) {
  const cards = useMemo(() => deckCards(p), [p]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-subtle">
        Guide du deck tel qu’il sort de la boîte. Pour l’améliorer avec le reste de ta collection,
        crée un deck avec et ouvre ses suggestions.
      </p>
      <DeckGuide cards={cards} name={p.set.name} onInspect={onInspect} />
    </div>
  );
}

/** Liste jouable d'UN produit : 3 exemplaires max (banlist), Main ≤ 60, Extra ≤ 15. */
function deckCards(p: OwnedProductDetailDto) {
  const room = { MAIN: 60, EXTRA: 15 };
  return p.cards.flatMap((c) => {
    const quantity = Math.min(c.quantity, maxCopiesFor(c.card.banTcg), room[c.zone]);
    if (quantity <= 0) return [];
    room[c.zone] -= quantity;
    return [{ cardId: c.card.id, zone: c.zone, quantity }];
  });
}

/** Liste texte pour reconstituer le produit (à coller dans une note, un message…). */
function listAsText(p: OwnedProductDetailDto): string {
  const lines = [`${p.set.name}${p.set.code ? ` (${p.set.code})` : ''} — ${p.copies} produit(s)`];
  for (const { label, match } of GROUPS) {
    const group = p.cards.filter(match);
    if (!group.length) continue;
    lines.push('', `${label} (${group.reduce((s, c) => s + c.needed, 0)})`);
    for (const c of group) lines.push(`${c.needed}x ${c.card.name} — ${c.printCode} (${c.rarity})`);
  }
  return lines.join('\n');
}
