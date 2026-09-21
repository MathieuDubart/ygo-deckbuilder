import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CatalogView } from '@/features/catalog/catalog-view';

export const metadata: Metadata = { title: 'Catalogue' };

export default function CardsPage() {
  return (
    <Suspense>
      <CatalogView />
    </Suspense>
  );
}
