'use client';
import { BookOpen, Layers, Library, LogOut, Heart, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout, useMe } from '@/lib/api/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/collection', label: 'Collection', icon: Library },
  { href: '/decks', label: 'Decks', icon: Layers },
  { href: '/suggestions', label: 'Suggestions', icon: Sparkles },
  { href: '/cards', label: 'Catalogue', icon: BookOpen },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-bg-sunken/60 px-3 py-5 md:flex">
        <Link href="/collection" className="mb-8 flex items-center gap-2 px-3">
          <Logo />
          <span className="font-semibold tracking-tight">Deck Builder</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
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
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 pt-4">
          <span className="truncate text-sm text-fg-muted">{me?.username ?? '…'}</span>
          <button
            onClick={() => logout.mutate()}
            className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-elevated hover:text-fg"
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <main className="px-4 pt-6 pb-28 md:px-10 md:py-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      {/* Tab bar mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
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
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
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
