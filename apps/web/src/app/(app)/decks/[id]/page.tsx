'use client';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/feedback';
import { DeckBuilder } from '@/features/deck-builder/deck-builder';
import { useDeck } from '@/lib/api/decks';

export default function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const { data: deck, isLoading, error } = useDeck(id);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !deck) return <p className="text-fg-muted">Deck introuvable.</p>;
  // key : on remonte le builder si on change de deck
  return <DeckBuilder key={deck.id} deck={deck} />;
}
