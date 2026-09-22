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
  /**
   * IA optionnelle pour rédiger les guides de deck (sinon : guide calculé).
   * openai = toute API compatible OpenAI (OpenAI, Mistral, LM Studio, Ollama…)
   */
  AI_PROVIDER: z.enum(['none', 'openai', 'anthropic']).default('none'),
  AI_BASE_URL: z
    .string()
    .optional()
    .transform((v) => v?.trim().replace(/\/+$/, '') || undefined),
  AI_API_KEY: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  AI_MODEL: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(600_000).default(180_000),
  /** Simulateur de duel (moteur EDOPro + scripts ProjectIgnis, téléchargés au démarrage). */
  DUEL_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  DUEL_DATA_DIR: z.string().default('data/duel'),
  /** Mise à jour des scripts et des bases de cartes. Vide = jamais. Défaut : mardi 3h. */
  DUEL_DATA_CRON: z.string().optional().default('0 3 * * 2'),
  DUEL_SCRIPTS_URL: z
    .url()
    .default('https://codeload.github.com/ProjectIgnis/CardScripts/tar.gz/refs/heads/master'),
  DUEL_CDB_URL: z
    .url()
    .default('https://codeload.github.com/ProjectIgnis/BabelCDB/tar.gz/refs/heads/master'),
  DUEL_STRINGS_URL: z
    .url()
    .default(
      'https://raw.githubusercontent.com/ProjectIgnis/Distribution/master/config/strings.conf',
    ),
  /** Duels simultanés (tous utilisateurs) et fermeture des duels inactifs */
  DUEL_MAX_SESSIONS: z.coerce.number().int().min(1).max(500).default(20),
  DUEL_IDLE_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .default(30),
  ADMIN_EMAIL: z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() || undefined),
});

export type Env = z.infer<typeof envSchema>;

const aiRule = (env: Env) =>
  env.AI_PROVIDER === 'none' ||
  !!env.AI_MODEL ||
  'AI_MODEL est obligatoire quand AI_PROVIDER est défini';

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuration invalide :\n${details.join('\n')}`);
  }
  const ai = aiRule(parsed.data);
  if (ai !== true) throw new Error(`Configuration invalide :\n  - ${ai}`);
  return parsed.data;
}
