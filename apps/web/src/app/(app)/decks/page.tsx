import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DecksView } from '@/features/decks/decks-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('decks') };
}

export default function DecksPage() {
  return <DecksView />;
}
