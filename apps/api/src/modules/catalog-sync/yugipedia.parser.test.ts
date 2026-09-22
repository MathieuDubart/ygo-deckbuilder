import { describe, expect, it } from 'vitest';
import { isValidTitle, mapPageImages } from './yugipedia.parser';

// Extrait d'une vraie réponse Yugipedia (21/09/2026)
const response = {
  batchcomplete: true,
  query: {
    normalized: [{ from: 'Legendary_Duelists', to: 'Legendary Duelists' }],
    redirects: [{ from: 'Old Name Tin', to: '2016 Mega-Tins' }],
    pages: [
      {
        pageid: 384785,
        ns: 0,
        title: '2016 Mega-Tins',
        thumbnail: {
          source: 'https://ms.yugipedia.com//thumb/7/77/CT13-PromoEN.png/600px-CT13-PromoEN.png',
          width: 600,
          height: 347,
        },
      },
      {
        pageid: 562912,
        ns: 0,
        title: 'Legendary Duelists: White Dragon Abyss',
        thumbnail: {
          source: 'https://ms.yugipedia.com//8/84/LED3-BoosterEN.png',
          width: 328,
          height: 583,
        },
      },
      { ns: 0, title: 'Legendary Duelists', missing: true },
      { pageid: 1, ns: 0, title: 'Some Page Without Image' },
    ],
  },
};

describe('mapPageImages', () => {
  it('associe chaque titre demandé à son image, via normalisation et redirection', () => {
    const map = mapPageImages(
      [
        'Legendary Duelists: White Dragon Abyss',
        'Old Name Tin',
        'Legendary_Duelists',
        'Some Page Without Image',
        'Unknown',
      ],
      response,
    );
    expect(map.get('Legendary Duelists: White Dragon Abyss')).toBe(
      'https://ms.yugipedia.com//8/84/LED3-BoosterEN.png',
    );
    expect(map.get('Old Name Tin')).toContain('600px-CT13-PromoEN.png');
    expect(map.get('Legendary_Duelists')).toBeNull();
    expect(map.get('Some Page Without Image')).toBeNull();
    expect(map.get('Unknown')).toBeNull();
  });

  it('supporte une réponse vide', () => {
    expect(mapPageImages(['X'], { query: undefined }).get('X')).toBeNull();
  });
});

describe('isValidTitle', () => {
  it('rejette les caractères interdits par MediaWiki', () => {
    expect(isValidTitle('Structure Deck: Albaz Strike')).toBe(true);
    expect(isValidTitle("2022 Tin of the Pharaoh's Gods")).toBe(true);
    expect(isValidTitle('Promo [2020]')).toBe(false);
  });
});
