import { describe, expect, it } from 'vitest';
import type { YgoCard } from '../catalog-sync/ygoprodeck.types';
import { parseBanlist } from './banlist.parser';

/**
 * Extrait réel de `cardinfo.php?banlist=tcg` (champs inutiles ôtés). Les trois cas qui
 * comptent : interdite des deux côtés, interdite d'un seul, et statut différent par format.
 */
const RESPONSE = [
  {
    id: 14558127,
    name: 'Ash Blossom & Joyous Spring',
    banlist_info: { ban_tcg: 'Limited', ban_ocg: 'Semi-Limited' },
  },
  { id: 23002292, name: 'Red-Eyes Dark Dragoon', banlist_info: { ban_tcg: 'Limited' } },
  { id: 14087893, name: 'Pot of Greed', banlist_info: { ban_tcg: 'Banned', ban_ocg: 'Banned' } },
  // Interdite en OCG seulement : elle n'a rien à faire dans la liste TCG
  { id: 41420027, name: 'Spirit Reaper', banlist_info: { ban_ocg: 'Limited' } },
  // Statut que la source n'utilise pas (ou plus) : on n'invente pas de limite
  { id: 99999999, name: 'Carte au statut inconnu', banlist_info: { ban_tcg: 'Unlimited' } },
  // Pas de banlist_info du tout
  { id: 88888888, name: 'Carte libre' },
] as unknown as YgoCard[];

describe('parseBanlist', () => {
  it('ne retient que les cartes de la liste demandée', () => {
    const tcg = parseBanlist(RESPONSE, 'tcg');
    expect(tcg.map((e) => e.cardId).sort()).toEqual([14087893, 14558127, 23002292]);

    const ocg = parseBanlist(RESPONSE, 'ocg');
    expect(ocg.map((e) => e.cardId).sort()).toEqual([14087893, 14558127, 41420027]);
  });

  it('ne mélange pas les deux formats sur une carte au statut différent', () => {
    const ash = (format: 'tcg' | 'ocg') =>
      parseBanlist(RESPONSE, format).find((e) => e.cardId === 14558127);
    expect(ash('tcg')).toEqual({ cardId: 14558127, label: 'Limited', status: 'LIMITED' });
    expect(ash('ocg')).toEqual({
      cardId: 14558127,
      label: 'Semi-Limited',
      status: 'SEMI_LIMITED',
    });
  });

  it('garde le libellé brut et le statut normalisé', () => {
    const pot = parseBanlist(RESPONSE, 'tcg').find((e) => e.cardId === 14087893);
    // « Banned » chez YGOPRODeck, « Forbidden » chez Konami : on stocke ce qu'on a reçu
    expect(pot).toEqual({ cardId: 14087893, label: 'Banned', status: 'FORBIDDEN' });
  });

  it('ignore un statut inconnu au lieu d’interdire la carte', () => {
    expect(parseBanlist(RESPONSE, 'tcg').some((e) => e.cardId === 99999999)).toBe(false);
  });

  it('écarte les doublons', () => {
    const twice = [...RESPONSE, RESPONSE[1]] as YgoCard[];
    expect(parseBanlist(twice, 'tcg')).toHaveLength(3);
  });
});
