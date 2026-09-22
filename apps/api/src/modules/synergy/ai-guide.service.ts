import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import type { AppLocale } from '@ygo/shared';
import { translator } from '../../common/i18n/locale-context';
import type { Translator } from '../../common/i18n/translator';
import type { RuleGuide } from './engine/guide';

/** Change quand le prompt évolue : invalide le cache. */
const PROMPT_VERSION = 4;
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

export type AiResult =
  | { status: 'OFF' | 'PENDING' }
  | { status: 'READY'; guide: AiGuide }
  | { status: 'ERROR'; error: string };

/** Rédaction en cours (ou échouée, en attente d'être signalée) pour une liste donnée. */
interface Job {
  error?: string;
}

export interface AiDeckCard {
  name: string;
  /** Nom dans la langue du guide (= name en anglais) */
  localName: string;
  zone: 'MAIN' | 'EXTRA' | 'SIDE';
  quantity: number;
  type: string;
  desc: string;
  roles: string[];
}

/** Consignes (en anglais : les modèles les suivent mieux), réponse dans la langue demandée. */
const system = (
  language: string,
) => `You are a competitive Yu-Gi-Oh! (TCG) player coaching a friend.
You receive a decklist with the official card texts, and a computed analysis (roles, combos, statistics).
Write a play guide in ${language}. Tone: friendly, casual but precise.
Strict rules:
- Only mention cards present in the decklist, using their localized name when one is given (otherwise the English name), in quotes.
- Never describe an effect that is not in the provided text. When in doubt, stay general.
- The computed combos are indicative: you may use, fix or extend them if they are wrong.
- Answer ONLY with a valid JSON object, no text around it, shaped like:
{"summary": string (3-5 sentences: deck identity, how it wins),
 "gamePlan": string[] (game plan steps),
 "keyCards": [{"name": exact card name as given, "why": why it matters}],
 "goingFirst": string[], "goingSecond": string[],
 "mistakes": string[] (concrete mistakes to avoid: sequencing, once per turn, Normal Summon, hand trap timing…),
 "tips": string[] (extra tips)}`;

/**
 * Rédaction du guide par un modèle de langage (optionnel) : OpenAI-compatible (OpenAI,
 * Mistral, LM Studio, Ollama…) ou Anthropic. Réponse validée par zod, mise en cache.
 * En cas d'échec, l'appelant garde le guide calculé.
 */
@Injectable()
export class AiGuideService {
  private readonly logger = new Logger(AiGuideService.name);
  private readonly jobs = new Map<string, Job>();
  /** File d'attente : une rédaction à la fois */
  private queue: Promise<void> = Promise.resolve();

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

  /**
   * Guide IA d'une liste, sans jamais bloquer la requête HTTP : un modèle local peut mettre
   * plusieurs minutes, bien au-delà des délais d'un proxy (Next, nginx…). La rédaction tourne
   * en arrière-plan (une à la fois : un serveur local ne sert qu'un modèle), le front
   * redemande jusqu'à READY / ERROR ; le résultat est mis en cache en base.
   */
  async request(
    deckName: string | undefined,
    cards: AiDeckCard[],
    rules: RuleGuide,
  ): Promise<AiResult> {
    if (!this.enabled) return { status: 'OFF' };
    const model = this.model!;
    // La langue est figée ici : la rédaction se fait hors de la requête HTTP
    const tr = translator();
    const key = cacheKey(model, cards, tr.locale);

    const cached = await this.prisma.deckGuideCache.findUnique({ where: { key } });
    if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_DAYS * 86_400_000) {
      const parsed = aiGuideSchema.safeParse(cached.content);
      if (parsed.success) return { status: 'READY', guide: parsed.data };
    }

    const job = this.jobs.get(key);
    if (job?.error) {
      // Échec signalé une fois ; la demande suivante ("Réessayer") relance une rédaction
      this.jobs.delete(key);
      return { status: 'ERROR', error: job.error };
    }
    if (job) return { status: 'PENDING' };

    const entry: Job = {};
    this.jobs.set(key, entry);
    this.queue = this.queue.then(async () => {
      const error = await this.write(key, model, deckName, cards, rules, tr);
      if (error) entry.error = error;
      else this.jobs.delete(key);
    });
    return { status: 'PENDING' };
  }

  /** Rédige et met en cache ; renvoie un message d'erreur lisible en cas d'échec. */
  private async write(
    key: string,
    model: string,
    deckName: string | undefined,
    cards: AiDeckCard[],
    rules: RuleGuide,
    tr: Translator,
  ): Promise<string | null> {
    const started = Date.now();
    try {
      const raw = await this.complete(
        system(tr.t('ai.language')),
        userPrompt(deckName, cards, rules, tr.locale),
      );
      const parsed = aiGuideSchema.safeParse(extractJson(raw));
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const why = raw.trim()
          ? tr.t('ai.errors.unusable', {
              path: issue?.path.join('.') || 'JSON',
              message: issue?.message ?? '?',
            })
          : tr.t('ai.errors.empty');
        this.logger.warn(`Guide IA : ${why}`);
        return why;
      }
      await this.prisma.deckGuideCache.upsert({
        where: { key },
        create: { key, model, content: parsed.data },
        update: { model, content: parsed.data, createdAt: new Date() },
      });
      this.logger.log(`Guide IA rédigé en ${Math.round((Date.now() - started) / 1000)} s`);
      return null;
    } catch (e) {
      const err = e as Error;
      const message =
        err.name === 'TimeoutError'
          ? tr.t('ai.errors.timeout', {
              seconds: Math.round(this.config.get('AI_TIMEOUT_MS') / 1000),
            })
          : /fetch failed|ECONNREFUSED/i.test(
                err.message + String((err as { cause?: unknown }).cause),
              )
            ? tr.t('ai.errors.unreachable', { url: this.config.get('AI_BASE_URL') ?? 'default' })
            : err.message;
      this.logger.warn(`Guide IA indisponible : ${message}`);
      return tr.t('ai.errors.unavailable', { message });
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

function cacheKey(model: string, cards: AiDeckCard[], locale: AppLocale): string {
  const list = cards
    .map((c) => `${c.zone}:${c.name}:${c.quantity}`)
    .sort()
    .join('|');
  return createHash('sha256').update(`${PROMPT_VERSION}|${locale}|${model}|${list}`).digest('hex');
}

/**
 * Tolère les réponses entourées de texte, de ```json, ou précédées d'un raisonnement
 * <think>…</think> (Qwen 3, DeepSeek R1… en local).
 */
export function extractJson(input: string): unknown {
  const raw = input.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function userPrompt(
  deckName: string | undefined,
  cards: AiDeckCard[],
  rules: RuleGuide,
  locale: AppLocale,
): string {
  const zone = (z: AiDeckCard['zone'], title: string) => {
    const xs = cards.filter((c) => c.zone === z);
    if (!xs.length) return '';
    return `## ${title}\n${xs
      .map((c) => {
        const local = c.localName !== c.name ? ` / ${locale.toUpperCase()}: ${c.localName}` : '';
        const roles = c.roles.length ? ` [${c.roles.join(', ')}]` : '';
        return `- ${c.quantity}x ${c.name}${local} (${c.type})${roles}\n  ${c.desc.replace(/\s+/g, ' ').slice(0, 700)}`;
      })
      .join('\n')}`;
  };
  return [
    `# Deck: ${deckName ?? 'untitled'}`,
    zone('MAIN', 'Main Deck'),
    zone('EXTRA', 'Extra Deck'),
    zone('SIDE', 'Side Deck'),
    '# Computed analysis',
    `Summary: ${rules.summary}`,
    `Stats: ${rules.stats.map((s) => `${s.label} ${s.value}`).join(' · ')}`,
    `Combos found:\n${rules.combos.map((c) => `- ${c.title}: ${c.steps.map((s) => s.text).join(' → ')}`).join('\n') || '(none)'}`,
    `Watch out for:\n${rules.mistakes.map((m) => `- ${m}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
