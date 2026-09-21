import { NextResponse, type NextRequest } from 'next/server';

const REFRESH_COOKIE = 'ygo_rt';
const AUTH_PAGES = ['/login', '/register'];

/**
 * Redirection "optimiste" basée sur la présence du cookie de session.
 * La vraie vérification reste côté API (le cookie peut être expiré/révoqué).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(REFRESH_COOKIE);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!hasSession && !isAuthPage && pathname !== '/') {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && (isAuthPage || pathname === '/')) {
    return NextResponse.redirect(new URL('/collection', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Tout sauf l'API relayée, les assets Next et les fichiers statiques
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
