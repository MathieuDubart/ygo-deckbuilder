'use client';
import { Copy, Layers, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/feedback';
import { useDecks, useDeleteDeck, useDuplicateDeck } from '@/lib/api/decks';
import { NewDeckDialog } from './new-deck-dialog';

export function DecksView() {
  const { data: decks, isLoading } = useDecks();
  const remove = useDeleteDeck();
  const duplicate = useDuplicateDeck();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Mes decks"
        description="Construis avec ce que tu as, vois ce qui manque."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nouveau deck
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !decks?.length ? (
        <EmptyState
          icon={Layers}
          title="Aucun deck pour l’instant"
          description="Pars de zéro, importe un .ydk, ou regarde les suggestions pour voir ce que ta collection permet déjà."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Nouveau deck
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <li
              key={d.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-bg-elevated transition hover:border-border-strong"
            >
              <Link href={`/decks/${d.id}`} className="flex gap-4 p-4">
                <div className="relative aspect-(--aspect-card) w-16 shrink-0 overflow-hidden rounded bg-bg-sunken">
                  {d.coverImageUrl && (
                    <Image
                      src={d.coverImageUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="truncate font-semibold">{d.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{d.format}</Badge>
                    <Badge tone={d.mainCount >= 40 && d.mainCount <= 60 ? 'success' : 'warning'}>
                      {d.mainCount} main
                    </Badge>
                    <Badge>{d.extraCount} extra</Badge>
                    {d.sideCount > 0 && <Badge>{d.sideCount} side</Badge>}
                  </div>
                  <p className="text-xs text-fg-subtle">
                    Modifié le {new Date(d.updatedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </Link>
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Dupliquer"
                  onClick={() =>
                    duplicate.mutate(d.id, { onSuccess: () => toast.success('Deck dupliqué') })
                  }
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer"
                  onClick={() => {
                    if (confirm(`Supprimer « ${d.name} » ?`)) remove.mutate(d.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NewDeckDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
