import type { NextConfig } from 'next';

/**
 * Le navigateur ne parle qu'au front (même origine) : /api/* est relayé vers l'API NestJS.
 * → cookies httpOnly first-party, pas de CORS, un seul domaine à exposer en prod.
 * API_URL est lue au build (rewrites sérialisées) : en Docker, c'est http://api:4000.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@ygo/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
  images: {
    // Les images passent par l'optimiseur Next → mises en cache chez nous,
    // on ne hotlinke pas YGOPRODeck à chaque affichage (cf. leurs règles d'usage).
    remotePatterns: [new URL('https://images.ygoprodeck.com/images/**')],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
