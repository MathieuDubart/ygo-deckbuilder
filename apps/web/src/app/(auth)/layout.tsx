import Link from 'next/link';
import { Logo } from '@/components/layout/app-shell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <Link href="/" className="flex items-center justify-center gap-2">
          <Logo />
          <span className="font-semibold tracking-tight">Deck Builder</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
