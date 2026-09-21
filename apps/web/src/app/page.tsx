import Link from 'next/link';
import { Logo } from '@/components/layout/app-shell';

/** Landing minimale (les utilisateurs connectés sont redirigés par le proxy). */
export default function Home() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 size-[60rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative max-w-2xl space-y-8 text-center">
        <Logo className="mx-auto size-12" />
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Ta collection. Tes decks.
          <span className="block text-fg-muted">Ce qu’il te manque.</span>
        </h1>
        <p className="mx-auto max-w-lg text-fg-muted text-pretty">
          Saisis tes cartes et tes structure decks, construis tes listes avec ce que tu possèdes
          vraiment, et découvre quels decks meta tu peux monter — avec le prix de ce qu’il reste à
          acheter.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-fg hover:brightness-110"
          >
            Créer un compte
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-5 py-3 text-sm font-medium hover:border-border-strong"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
}
