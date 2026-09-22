'use client';
import { CARD_LANGUAGES, type CardLanguage, type CardSetDto, type ProductKind } from '@ygo/shared';
import { ArrowLeft, Package, PackageOpen, Search } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/input';
import { useSets } from '@/lib/api/cards';
import { useImportSet } from '@/lib/api/collection';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';

const KINDS: { value: ProductKind | undefined; label: string }[] = [
  { value: undefined, label: 'Tout' },
  { value: 'STRUCTURE', label: 'Decks de structure' },
  { value: 'TIN', label: 'Boîtes (tins)' },
  { value: 'STARTER', label: 'Decks de démarrage' },
  { value: 'BOX', label: 'Coffrets' },
  { value: 'OTHER', label: 'Boosters & autres' },
];

/**
 * Ajout d'un produit entier à la collection. Galerie visuelle : on reconnaît sa boîte
 * sans connaître son nom anglais.
 */
export function ImportSetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ProductKind | undefined>();
  const [selected, setSelected] = useState<CardSetDto | null>(null);
  const debouncedQ = useDebounced(q);
  const { data: sets, isLoading, isFetching } = useSets({ q: debouncedQ || undefined, kind });

  function close() {
    setSelected(null);
    setQ('');
    setKind(undefined);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={selected ? selected.name : 'Ajouter un produit entier'}
      className="w-[min(94vw,56rem)]"
    >
      {selected ? (
        <ConfirmImport set={selected} onBack={() => setSelected(null)} onDone={close} />
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              autoFocus
              type="search"
              placeholder="Filtrer : « dragon », « 2022 », code du set (SDBE)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          <div
            className="flex gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Type de produit"
          >
            {KINDS.map((k) => (
              <button
                key={k.label}
                type="button"
                role="tab"
                aria-selected={kind === k.value}
                onClick={() => setKind(k.value)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  kind === k.value
                    ? 'border-accent/50 bg-accent/15 text-fg'
                    : 'border-border text-fg-muted hover:text-fg',
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div
            className={cn(
              'grid max-h-[55dvh] grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 overflow-y-auto pr-1 transition',
              isFetching && 'opacity-60',
            )}
          >
            {isLoading ? (
              Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)
            ) : !sets?.length ? (
              <p className="col-span-full py-10 text-center text-sm text-fg-subtle">
                Aucun produit trouvé. Essaie un autre type, un mot-clé ou le code imprimé sur tes
                cartes.
              </p>
            ) : (
              sets.map((s) => <ProductTile key={s.id} set={s} onClick={() => setSelected(s)} />)
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ProductCover({
  set,
  className,
  sizes,
}: {
  set: CardSetDto;
  className?: string;
  sizes: string;
}) {
  // Visuel HD indisponible → visuel de secours → pictogramme (jamais d'image cassée)
  const sources = [set.imageUrl, set.fallbackImageUrl].filter((u): u is string => !!u);
  const [attempt, setAttempt] = useState(0);
  const src = sources[attempt];
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-bg-sunken', className)}>
      {src ? (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes={sizes}
          quality={90}
          className="object-contain p-1.5"
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <div className="grid h-full place-items-center">
          <Package className="size-8 text-fg-subtle" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}

function ProductTile({ set, onClick }: { set: CardSetDto; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-xl border border-transparent p-1.5 text-left transition hover:border-border hover:bg-bg-sunken/60"
    >
      <ProductCover
        set={set}
        sizes="(max-width: 640px) 45vw, 170px"
        className="aspect-[3/4] w-full transition group-hover:-translate-y-0.5"
      />
      <span className="line-clamp-2 text-xs leading-snug font-medium">{set.name}</span>
      <span className="font-mono text-[11px] text-fg-subtle">
        {set.code ?? '—'}
        {set.tcgDate && ` · ${set.tcgDate.slice(0, 4)}`} · {set.cardCount} cartes
      </span>
    </button>
  );
}

function ConfirmImport({
  set,
  onBack,
  onDone,
}: {
  set: CardSetDto;
  onBack: () => void;
  onDone: () => void;
}) {
  const importSet = useImportSet();
  const [copies, setCopies] = useState(1);
  const [language, setLanguage] = useState<CardLanguage>('FR');

  return (
    <div className="grid gap-6 sm:grid-cols-[14rem_1fr]">
      <ProductCover
        set={set}
        sizes="(max-width: 640px) 80vw, 224px"
        className="mx-auto aspect-[3/4] w-full max-w-56"
      />
      <div className="flex flex-col gap-4">
        <div className="space-y-1 text-sm">
          <p className="font-mono text-fg-subtle">
            {set.code ?? '—'}
            {set.tcgDate && ` · sorti le ${new Date(set.tcgDate).toLocaleDateString('fr-FR')}`}
          </p>
          <p className="text-fg-muted">
            <strong className="text-fg">{set.cardCount} cartes</strong> seront ajoutées à ta
            collection. Les quantités exactes du produit ne sont pas connues : ajuste ensuite les
            cartes en 2 ou 3 exemplaires.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Exemplaires de chaque">
            <Input
              type="number"
              min={1}
              max={10}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, +e.target.value))}
            />
          </Field>
          <Field label="Langue">
            <Select value={language} onChange={(e) => setLanguage(e.target.value as CardLanguage)}>
              {CARD_LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>

        {importSet.error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {importSet.error.message}
          </p>
        )}

        <div className="mt-auto flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="size-4" /> Retour
          </Button>
          <Button
            className="flex-1"
            loading={importSet.isPending}
            onClick={() =>
              importSet.mutate(
                { setName: set.name, copies, language },
                {
                  onSuccess: (r) => {
                    toast.success(`${r.cardsAdded} cartes ajoutées depuis « ${r.set} »`);
                    onDone();
                  },
                },
              )
            }
          >
            <PackageOpen className="size-4" /> Ajouter {set.cardCount} cartes
          </Button>
        </div>
      </div>
    </div>
  );
}
