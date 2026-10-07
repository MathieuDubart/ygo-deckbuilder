'use client';
import {
  BookOpen,
  Heart,
  Layers,
  Library,
  LogOut,
  ScrollText,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useLogout, useMe } from '@/lib/api/auth';
import { useFriendRequests } from '@/lib/api/social';
import { Avatar } from '@/features/social/avatar';
import { cn } from '@/lib/utils';
import { LocaleSwitcher } from './locale-switcher';

const NAV = [
  { href: '/collection', key: 'collection', icon: Library },
  { href: '/decks', key: 'decks', icon: Layers },
  { href: '/suggestions', key: 'suggestions', icon: Sparkles },
  { href: '/cards', key: 'catalog', icon: BookOpen },
  { href: '/wishlist', key: 'wishlist', icon: Heart },
  { href: '/duel', key: 'duel', icon: Swords },
] as const;

/** Liens secondaires (barre latérale seulement) */
const SECONDARY = [
  { href: '/friends', key: 'friends', icon: Users },
  { href: '/rules', key: 'rules', icon: ScrollText },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const logout = useLogout();
  const t = useTranslations('layout');
  // Demandes d'ami reçues : le seul chiffre de l'app qui demande une action
  const { data: requests } = useFriendRequests();
  const pending = requests?.filter((request) => request.direction === 'INCOMING').length ?? 0;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-bg-sunken/60 px-3 py-5 md:flex">
        <Link href="/collection" className="mb-8 flex items-center gap-2 px-3">
          <Logo />
          <span className="font-semibold tracking-tight">{t('appName')}</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  active ? 'bg-bg-elevated font-medium text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                <Icon className={cn('size-4', active && 'text-accent')} />
                {t(`nav.${key}`)}
              </Link>
            );
          })}
          <div className="my-3 border-t border-border" />
          {SECONDARY.map(({ href, key, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  active ? 'bg-bg-elevated font-medium text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                <Icon className={cn('size-4', active && 'text-accent')} />
                {t(`nav.${key}`)}
                {key === 'friends' && pending > 0 && <PendingDot count={pending} />}
              </Link>
            );
          })}
        </nav>
        <LocaleSwitcher className="mb-3 px-3" />
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 pt-4">
          {me ? (
            <Link
              href="/profile"
              className="flex min-w-0 items-center gap-2 text-sm text-fg-muted hover:text-fg"
            >
              <Avatar
                user={{
                  id: me.id,
                  username: me.username,
                  avatarUrl: me.avatarUrl ?? null,
                  bannerUrl: null,
                }}
              />
              <span className="truncate">{me.username}</span>
            </Link>
          ) : (
            <span className="truncate text-sm text-fg-muted">…</span>
          )}
          <button
            onClick={() => logout.mutate()}
            className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-elevated hover:text-fg"
            aria-label={t('logout')}
            title={t('logout')}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <main className="px-4 pt-6 pb-28 md:px-10 md:py-10">
        <div className="mb-4 flex items-center justify-end gap-3 md:hidden">
          <LocaleSwitcher />
          {me && (
            <Link href="/profile" className="relative" aria-label={t('nav.profile')}>
              <Avatar
                user={{
                  id: me.id,
                  username: me.username,
                  avatarUrl: me.avatarUrl ?? null,
                  bannerUrl: null,
                }}
                size="md"
              />
              {pending > 0 && <PendingDot count={pending} className="absolute -top-1 -right-1" />}
            </Link>
          )}
        </div>
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      {/* Tab bar mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[10px]',
                active ? 'text-accent' : 'text-fg-subtle',
              )}
            >
              <Icon className="size-5" />
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Nombre de demandes d'ami reçues. Discret, mais c'est une action en attente. */
function PendingDot({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'ml-auto flex min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-accent-fg',
        className,
      )}
    >
      {count}
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6 text-accent', className)} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.8 3.8L12 12 5.2 8.1 12 4.3Z"
      />
    </svg>
  );
}
