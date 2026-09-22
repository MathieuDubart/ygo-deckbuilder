import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { CatalogView } from '@/features/catalog/catalog-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('catalog') };
}

export default function CardsPage() {
  return (
    <Suspense>
      <CatalogView />
    </Suspense>
  );
}
