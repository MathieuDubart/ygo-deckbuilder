import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CollectionView } from '@/features/collection/collection-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('collection') };
}

export default function CollectionPage() {
  return <CollectionView />;
}
