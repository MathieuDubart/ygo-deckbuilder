import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DuelView } from '@/features/duel/duel-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('duel') };
}

export default function DuelPage() {
  return <DuelView />;
}
