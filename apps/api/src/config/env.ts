import { z } from 'zod';

/** Toutes les variables d'env sont validées au démarrage : on crashe tôt plutôt que tard. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  YGOPRODECK_BASE_URL: z.url().default('https://db.ygoprodeck.com/api/v7'),
  CARD_SYNC_CRON: z.string().optional().default(''),
  YGOPRODECK_DECKS_URL: z.url().default('https://ygoprodeck.com/api/decks/getDecks.php'),
  /** Mise à jour du meta (listes de tournoi). Vide = désactivée. Défaut : lundi 5h. */
  META_SYNC_CRON: z.string().optional().default('0 5 * * 1'),
  /** Pages de ~20 listes récupérées à chaque mise à jour (15 ≈ 300 listes ≈ 1 mois de tournois). */
  META_SYNC_PAGES: z.coerce.number().int().min(1).max(50).default(15),
  CARD_SYNC_ON_BOOT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  YUGIPEDIA_API_URL: z.url().default('https://yugipedia.com/api.php'),
  /** Visuels HD des produits via Yugipedia (sinon, petits visuels YGOPRODeck). */
  PRODUCT_COVERS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ADMIN_EMAIL: z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() || undefined),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuration invalide :\n${details.join('\n')}`);
  }
  return parsed.data;
}
