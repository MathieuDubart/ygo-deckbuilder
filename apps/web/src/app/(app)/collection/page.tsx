import type { Metadata } from 'next';
import { CollectionView } from '@/features/collection/collection-view';

export const metadata: Metadata = { title: 'Collection' };

export default function CollectionPage() {
  return <CollectionView />;
}
