import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RulesView } from '@/features/rules/rules-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('rules') };
}

export default function RulesPage() {
  return <RulesView />;
}
