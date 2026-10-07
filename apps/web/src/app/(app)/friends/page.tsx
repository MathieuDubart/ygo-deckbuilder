import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FriendsPage } from '@/features/social/friends-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('friends') };
}

export default function Friends() {
  return <FriendsPage />;
}
