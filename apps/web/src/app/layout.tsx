import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Providers } from '@/components/layout/providers';
import './globals.css';

/**
 * Archivo variable, servie par nous : poids 100→900 ET largeur 62→125 % dans un seul fichier
 * de 90 ko. Auto-hébergée plutôt que prise chez Google — une instance privée ne doit dépendre
 * de personne pour s'afficher, et ça évite une requête vers un tiers à chaque visite.
 */
const archivo = localFont({
  src: '../../node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2',
  variable: '--font-archivo',
  display: 'swap',
  weight: '100 900',
  style: 'normal',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('layout');
  return {
    title: { default: t('metaTitle'), template: `%s · ${t('metaTitle')}` },
    description: t('metaDescription'),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1d1a16' },
    { media: '(prefers-color-scheme: light)', color: '#f7f4ee' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={archivo.variable}>
      <body className="font-sans">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
