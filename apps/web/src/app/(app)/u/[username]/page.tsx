import type { Metadata } from 'next';
import { ProfilePage } from '@/features/social/profile-page';

/** Le pseudo est le titre : c'est ce qu'on cherche dans un onglet ouvert. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: decodeURIComponent(username) };
}

export default async function UserProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfilePage username={decodeURIComponent(username)} />;
}
