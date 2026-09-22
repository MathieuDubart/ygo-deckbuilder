import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Logo } from '@/components/layout/app-shell';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('layout');
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <Link href="/" className="flex items-center justify-center gap-2">
          <Logo />
          <span className="font-semibold tracking-tight">{t('appName')}</span>
        </Link>
        {children}
        <LocaleSwitcher className="mx-auto w-fit" />
      </div>
    </main>
  );
}
