import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import type { RuleGuide } from './engine/guide';

/** Change quand le prompt évolue : invalide le cache. */
const PROMPT_VERSION = 3;
const CACHE_TTL_DAYS = 30;

/** Ce que l'IA a le droit de réécrire. Les combos et les stats restent calculés (fiables). */
export const aiGuideSchema = z.object({
  summary: z.string().min(20).max(1200),
  gamePlan: z.array(z.string().min(5).max(600)).min(1).max(8),
  keyCards: z
    .array(z.object({ name: z.string(), why: z.string().min(5).max(400) }))
    .max(10)
    .default([]),
  goingFirst: z.array(z.string().min(5).max(500)).max(6).default([]),
  goingSecond: z.array(z.string().min(5).max(500)).max(6).default([]),
  mistakes: z.array(z.string().min(5).max(500)).min(1).max(10),
  tips: z.array(z.string().min(5).max(500)).max(6).default([]),
});
export type AiGuide = z.infer<typeof aiGuideSchema>;

export interface AiDeckCard {
  name: string;
  nameFr: string;
  zone: 'MAIN' | 'EXTRA' | 'SIDE';
  quantity: number;
  type: string;
  desc: string;
  roles: string[];
}

const SYSTEM = `Tu es un joueur compétitif de Yu-Gi-Oh! (TCG) qui coache un ami.
Tu reçois une decklist avec le texte officiel des cartes, et une analyse calculée (rôles, combos, statistiques).
Écris un guide de jeu en français, ton décontracté mais précis, tutoiement.
Règles strictes :
- Ne cite QUE des cartes présentes dans la decklist, avec leur nom français s'il est fourni (sinon anglais), entre « ».
- Ne décris jamais un effet qui n'est pas dans le texte fourni. En cas de doute, reste général.
- Les combos calculés sont indicatifs : tu peux t'en servir, les corriger ou les compléter s'ils sont faux.
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de la forme :
{"summary": string (3-5 phrases : identité du deck, comment il gagne),
 "gamePlan": string[] (étapes du plan de jeu),
 "keyCards": [{"name": nom exact de la carte tel que donné, "why": pourquoi elle compte}],
 "goingFirst": string[], "goingSecond": string[],
 "mistakes": string[] (erreurs concrètes à éviter : séquençage, 1 fois par tour, Invocation Normale, timing des hand traps…),
 "tips": string[] (astuces en plus)}`;

/**
 * Rédaction du guide par un modèle de langage (optionnel) : OpenAI-compatible (OpenAI,
 * Mistral, LM Studio, Ollama…) ou Anthropic. Réponse validée par zod, mise en cache.
 * En cas d'échec, l'appelant garde le guide calculé.
 */
@Injectable()
export class AiGuideService {
  private readonly logger = new Logger(AiGuideService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  get enabled(): boolean {
    return this.config.get('AI_PROVIDER') !== 'none' && !!this.config.get('AI_MODEL');
  }

  get model(): string | null {
    return this.enabled ? this.config.get('AI_MODEL')! : null;
  }

  async write(
    deckName: string | undefined,
    cards: AiDeckCard[],
    rules: RuleGuide,
  ): Promise<AiGuide | null> {
    if (!this.enabled) return null;
    const model = this.model!;
    const key = cacheKey(model, cards);

    const cached = await this.prisma.deckGuideCache.findUnique({ where: { key } });
    if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_DAYS * 86_400_000) {
      const parsed = aiGuideSchema.safeParse(cached.content);
      if (parsed.success) return parsed.data;
    }

    try {
      const raw = await this.complete(SYSTEM, userPrompt(deckName, cards, rules));
      const parsed = aiGuideSchema.safeParse(extractJson(raw));
      if (!parsed.success) {
        this.logger.warn(
          `Réponse IA invalide : ${parsed.error.issues[0]?.message ?? 'JSON illisible'}`,
        );
        return null;
      }
      await this.prisma.deckGuideCache.upsert({
        where: { key },
        create: { key, model, content: parsed.data },
        update: { model, content: parsed.data, createdAt: new Date() },
      });
      return parsed.data;
    } catch (e) {
      this.logger.warn(`Guide IA indisponible : ${(e as Error).message}`);
      return null;
    }
  }

  private async complete(system: string, user: string): Promise<string> {
    const provider = this.config.get('AI_PROVIDER');
    const key = this.config.get('AI_API_KEY');
    const model = this.config.get('AI_MODEL')!;
    const signal = AbortSignal.timeout(this.config.get('AI_TIMEOUT_MS'));

    if (provider === 'anthropic') {
      const base = this.config.get('AI_BASE_URL') ?? 'https://api.anthropic.com';
      const res = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(key && { 'x-api-key': key }),
        },
        body: JSON.stringify({
          model,
          max_tokens: 3000,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok)
        throw new Error(
          `Anthropic ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300),
        );
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      return (
        json.content
          ?.filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('') ?? ''
      );
    }

    const base = this.config.get('AI_BASE_URL') ?? 'https://api.openai.com/v1';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        ...(key && { authorization: `Bearer ${key}` }),
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok)
      throw new Error(`IA ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? '';
  }
}

function cacheKey(model: string, cards: AiDeckCard[]): string {
  const list = cards
    .map((c) => `${c.zone}:${c.name}:${c.quantity}`)
    .sort()
    .join('|');
  return createHash('sha256').update(`${PROMPT_VERSION}|${model}|${list}`).digest('hex');
}

/** Tolère les réponses entourées de texte ou de ```json. */
export function extractJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function userPrompt(deckName: string | undefined, cards: AiDeckCard[], rules: RuleGuide): string {
  const zone = (z: AiDeckCard['zone'], title: string) => {
    const xs = cards.filter((c) => c.zone === z);
    if (!xs.length) return '';
    return `## ${title}\n${xs
      .map((c) => {
        const fr = c.nameFr !== c.name ? ` / FR: ${c.nameFr}` : '';
        const roles = c.roles.length ? ` [${c.roles.join(', ')}]` : '';
        return `- ${c.quantity}x ${c.name}${fr} (${c.type})${roles}\n  ${c.desc.replace(/\s+/g, ' ').slice(0, 700)}`;
      })
      .join('\n')}`;
  };
  return [
    `# Deck : ${deckName ?? 'sans nom'}`,
    zone('MAIN', 'Main Deck'),
    zone('EXTRA', 'Extra Deck'),
    zone('SIDE', 'Side Deck'),
    '# Analyse calculée',
    `Résumé : ${rules.summary}`,
    `Stats : ${rules.stats.map((s) => `${s.label} ${s.value}`).join(' · ')}`,
    `Combos trouvés :\n${rules.combos.map((c) => `- ${c.title} : ${c.steps.map((s) => s.text).join(' → ')}`).join('\n') || '(aucun)'}`,
    `Points d'attention :\n${rules.mistakes.map((m) => `- ${m}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
