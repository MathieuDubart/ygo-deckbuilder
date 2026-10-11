import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminPage } from '@/features/admin/admin-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('admin') };
}

export default function Admin() {
  return <AdminPage />;
}
