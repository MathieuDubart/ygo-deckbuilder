import type { Metadata } from 'next';
import { DecksView } from '@/features/decks/decks-view';

export const metadata: Metadata = { title: 'Decks' };

export default function DecksPage() {
  return <DecksView />;
}
