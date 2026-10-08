'use client';
import type { PublicUserDto } from '@ygo/shared';
import Image from 'next/image';
import Link from 'next/link';
import { imageUrl } from '@/lib/api/social';
import { cn } from '@/lib/utils';

const SIZES = { xs: 20, sm: 28, md: 40, lg: 96 } as const;

/**
 * Avatar d'un compte. Sans image, l'initiale du pseudo sur un fond dérivé de ce même pseudo :
 * deux comptes gardent des couleurs différentes, et rien n'est jamais vide.
 */
export function Avatar({
  user,
  size = 'sm',
  className,
}: {
  user: PublicUserDto;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];
  const url = imageUrl(user.avatarUrl);
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        !url && 'font-semibold text-white',
        className,
      )}
      style={{
        width: px,
        height: px,
        ...(!url && { backgroundColor: tint(user.username) }),
        fontSize: Math.round(px * 0.42),
      }}
      aria-hidden
    >
      {url ? (
        <Image src={url} alt="" width={px} height={px} className="size-full object-cover" />
      ) : (
        user.username.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/** Avatar + pseudo, cliquable vers le profil. L'élément de liste le plus répété de la feature. */
export function UserChip({
  user,
  size = 'sm',
  className,
}: {
  user: PublicUserDto;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Link
      href={`/u/${encodeURIComponent(user.username)}`}
      className={cn('group inline-flex min-w-0 items-center gap-2', className)}
    >
      <Avatar user={user} size={size} />
      <span className="truncate text-sm font-medium group-hover:underline">{user.username}</span>
    </Link>
  );
}

/**
 * Couleur stable déduite du pseudo. Teinte seule : la saturation et la luminosité sont fixées,
 * donc l'initiale blanche reste lisible quelle que soit la teinte tirée.
 */
function tint(username: string): string {
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  // Teinte très désaturée : deux comptes restent distinguables sans voler la vedette aux
  // cartes, seules choses colorées de l'interface.
  return `oklch(0.52 0.045 ${hash})`;
}
