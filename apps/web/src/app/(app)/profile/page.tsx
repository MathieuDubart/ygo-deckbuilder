import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProfilePage } from '@/features/social/profile-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout.pages');
  return { title: t('profile') };
}

export default function MyProfile() {
  return <ProfilePage />;
}
