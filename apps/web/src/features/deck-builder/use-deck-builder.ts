'use client';
import {
  DECK_RULES,
  banStatusForFormat,
  banStatusOf,
  banlistFixes,
  maxCopiesFor,
  validateDeck,
  type CardSummaryDto,
  type DeckDto,
  type DeckZone,
} from '@ygo/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUpdateDeck } from '@/lib/api/decks';

export interface BuilderEntry {
  card: CardSummaryDto;
  zone: DeckZone;
  quantity: number;
  owned: number;
}

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

const key = (zone: DeckZone, cardId: number) => `${zone}:${cardId}`;

/**
 * État local du builder : édition instantanée (optimiste), validation live via les règles
 * partagées, et sauvegarde automatique debouncée vers l'API.
 */
export function useDeckBuilder(deck: DeckDto) {
  const t = useTranslations('deckBuilder.add');
  const tBan = useTranslations('cards.ban');
  const tc = useTranslations('common');
  const update = useUpdateDeck(deck.id);
  const [entries, setEntries] = useState<Map<string, BuilderEntry>>(() => fromDeck(deck));
  const [status, setStatus] = useState<SaveStatus>('saved');
  const version = useRef(0);

  const list = useMemo(() => [...entries.values()], [entries]);

  const byZone = useMemo(() => {
    const z: Record<DeckZone, BuilderEntry[]> = { MAIN: [], EXTRA: [], SIDE: [] };
    for (const e of list) z[e.zone].push(e);
    for (const zone of Object.values(z)) zone.sort(compareEntries);
    return z;
  }, [list]);

  const counts = useMemo(
    () => ({
      MAIN: sum(byZone.MAIN),
      EXTRA: sum(byZone.EXTRA),
      SIDE: sum(byZone.SIDE),
    }),
    [byZone],
  );

  /** La decklist dans la forme que comprennent les règles partagées. */
  const forValidation = useMemo(
    () =>
      list.map((e) => ({
        cardId: e.card.id,
        zone: e.zone,
        quantity: e.quantity,
        isExtraDeckMonster: e.card.isExtraDeck,
        banStatus: banStatusForFormat(e.card, deck.format),
      })),
    [list, deck.format],
  );

  const issues = useMemo(() => validateDeck(forValidation), [forValidation]);

  /** Les exemplaires à retirer pour repasser la banlist, ou une liste vide si tout va bien. */
  const fixes = useMemo(() => banlistFixes(forValidation), [forValidation]);

  const totalCopiesOf = useCallback(
    (cardId: number) =>
      list.filter((e) => e.card.id === cardId).reduce((s, e) => s + e.quantity, 0),
    [list],
  );

  /** Exemplaires autorisés pour cette carte, selon le format du deck. */
  const limitOf = useCallback(
    (card: CardSummaryDto) => maxCopiesFor(banStatusForFormat(card, deck.format)),
    [deck.format],
  );

  /**
   * Pourquoi cette carte ne peut pas être ajoutée, ou `null` si elle peut. Le picker s'en sert
   * pour éteindre la vignette AVANT le clic : apprendre qu'une carte est interdite au moment où
   * on la clique, c'est l'apprendre trop tard.
   */
  const blockedReason = useCallback(
    (card: CardSummaryDto): string | null => {
      const status = banStatusOf(banStatusForFormat(card, deck.format));
      if (status === 'FORBIDDEN') return tBan('FORBIDDEN');
      const count = totalCopiesOf(card.id);
      if (count < limitOf(card)) return null;
      // Dire ce qui bloque, pas la règle : « déjà 3 exemplaires » se comprend, « maximum 3 »
      // laisse croire qu'on énonce une limite théorique alors qu'on vient de la toucher.
      return status ? t('atLimitBan', { status: tBan(status), count }) : t('atLimit', { count });
    },
    [deck.format, limitOf, tBan, totalCopiesOf, t],
  );

  /** Ajoute 1 exemplaire. Zone par défaut : EXTRA pour les monstres extra, sinon MAIN. */
  const add = useCallback(
    (card: CardSummaryDto, zone?: DeckZone): { ok: boolean; reason?: string } => {
      const target: DeckZone = zone ?? (card.isExtraDeck ? 'EXTRA' : 'MAIN');
      if (target === 'MAIN' && card.isExtraDeck)
        return { ok: false, reason: t('extraDeckMonster') };
      if (target === 'EXTRA' && !card.isExtraDeck) return { ok: false, reason: t('notExtraDeck') };
      const blocked = blockedReason(card);
      if (blocked) return { ok: false, reason: blocked };
      if (counts[target] >= DECK_RULES[target].max)
        return { ok: false, reason: t('zoneFull', { zone: tc(`zones.${target}`) }) };

      setEntries((prev) => {
        const next = new Map(prev);
        const k = key(target, card.id);
        const cur = next.get(k);
        next.set(k, {
          card,
          zone: target,
          quantity: (cur?.quantity ?? 0) + 1,
          owned: card.ownedQuantity ?? cur?.owned ?? 0,
        });
        return next;
      });
      return { ok: true };
    },
    [blockedReason, counts, t, tc],
  );

  /**
   * Applique le correctif de banlist : on retire, rien d'autre. Déplacer un exemplaire vers le
   * Side ne réparerait rien — la limite compte le deck entier, Side inclus.
   */
  const applyBanlistFixes = useCallback(() => {
    if (fixes.length === 0) return;
    setEntries((prev) => {
      const next = new Map(prev);
      for (const fix of fixes) {
        const k = key(fix.zone, fix.cardId);
        const cur = next.get(k);
        if (!cur) continue;
        const left = cur.quantity - fix.remove;
        if (left > 0) next.set(k, { ...cur, quantity: left });
        else next.delete(k);
      }
      return next;
    });
  }, [fixes]);

  const removeOne = useCallback((zone: DeckZone, cardId: number) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const k = key(zone, cardId);
      const cur = next.get(k);
      if (!cur) return prev;
      if (cur.quantity <= 1) next.delete(k);
      else next.set(k, { ...cur, quantity: cur.quantity - 1 });
      return next;
    });
  }, []);

  // Sauvegarde auto 800 ms après la dernière modif
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setStatus('dirty');
    const v = ++version.current;
    const timer = setTimeout(() => {
      setStatus('saving');
      update.mutate(
        { cards: list.map((e) => ({ cardId: e.card.id, zone: e.zone, quantity: e.quantity })) },
        {
          onSuccess: () => v === version.current && setStatus('saved'),
          onError: () => v === version.current && setStatus('error'),
        },
      );
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const missing = useMemo(() => {
    const need = new Map<number, { card: CardSummaryDto; required: number; owned: number }>();
    for (const e of list) {
      const cur = need.get(e.card.id);
      need.set(e.card.id, {
        card: e.card,
        required: (cur?.required ?? 0) + e.quantity,
        owned: e.owned,
      });
    }
    return [...need.values()]
      .filter((n) => n.required > n.owned)
      .map((n) => ({ ...n, missing: n.required - n.owned }));
  }, [list]);

  return {
    byZone,
    counts,
    issues,
    fixes,
    applyBanlistFixes,
    add,
    blockedReason,
    limitOf,
    totalCopiesOf,
    removeOne,
    status,
    missing,
    retry: () => setEntries((e) => new Map(e)),
  };
}

function fromDeck(deck: DeckDto): Map<string, BuilderEntry> {
  return new Map(
    deck.cards.map((c) => [
      key(c.zone, c.cardId),
      { card: c.card, zone: c.zone, quantity: c.quantity, owned: c.ownedQuantity },
    ]),
  );
}

const sum = (xs: BuilderEntry[]) => xs.reduce((s, e) => s + e.quantity, 0);

const CATEGORY_ORDER = { MONSTER: 0, SPELL: 1, TRAP: 2, SKILL: 3, TOKEN: 4 } as const;
function compareEntries(a: BuilderEntry, b: BuilderEntry) {
  return (
    CATEGORY_ORDER[a.card.category] - CATEGORY_ORDER[b.card.category] ||
    (b.card.level ?? 0) - (a.card.level ?? 0) ||
    a.card.name.localeCompare(b.card.name)
  );
}
