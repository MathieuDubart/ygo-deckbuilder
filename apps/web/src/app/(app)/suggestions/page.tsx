import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SuggestionsView } from '@/features/suggestions/suggestions-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('suggestions') };
}

export default function SuggestionsPage() {
  return <SuggestionsView />;
}
