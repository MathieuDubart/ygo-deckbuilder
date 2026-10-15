import { describe, expect, it } from 'vitest';
import { cardmarketSearchUrl, cardmarketWantsUrl, marketName, wantsListText } from './cardmarket';

describe('cardmarketSearchUrl', () => {
  it('cherche sur le nom anglais', () => {
    const url = new URL(cardmarketSearchUrl('Blue-Eyes White Dragon'));
    expect(url.pathname).toBe('/en/YuGiOh/Products/Search');
    expect(url.searchParams.get('searchString')).toBe('Blue-Eyes White Dragon');
  });

  it('échappe ce qui casserait l’URL', () => {
    const url = cardmarketSearchUrl('Harpie & Pet Dragon');
    expect(url).toContain('searchString=Harpie%20%26%20Pet%20Dragon');
    expect(new URL(url).searchParams.get('searchString')).toBe('Harpie & Pet Dragon');
  });

  it('traduit langue et état en identifiants Cardmarket', () => {
    const url = new URL(
      cardmarketSearchUrl('Dark Magician', { language: 'FR', minCondition: 'NEAR_MINT' }),
    );
    expect(url.searchParams.get('language')).toBe('2');
    expect(url.searchParams.get('minCondition')).toBe('2');
  });

  it('numérote les états du meilleur au pire', () => {
    const idOf = (condition: Parameters<typeof cardmarketSearchUrl>[1]) =>
      new URL(cardmarketSearchUrl('X', condition)).searchParams.get('minCondition');
    expect(idOf({ minCondition: 'MINT' })).toBe('1');
    expect(idOf({ minCondition: 'EXCELLENT' })).toBe('3');
    expect(idOf({ minCondition: 'POOR' })).toBe('7');
  });

  // Mieux vaut une fiche non filtrée qu'un filtre inventé : Cardmarket ne publie pas
  // d'identifiant pour ces langues-là.
  it('omet le filtre pour une langue sans identifiant connu', () => {
    const url = new URL(cardmarketSearchUrl('Dark Magician', { language: 'JP' }));
    expect(url.searchParams.has('language')).toBe(false);
    expect(url.searchParams.get('searchString')).toBe('Dark Magician');
  });

  it('n’ajoute aucun filtre sans préférence', () => {
    const url = new URL(
      cardmarketSearchUrl('Pot of Greed', { language: null, minCondition: null }),
    );
    expect([...url.searchParams.keys()]).toEqual(['searchString']);
  });

  it('suit la langue d’interface quand Cardmarket la parle', () => {
    expect(new URL(cardmarketSearchUrl('X', {}, 'fr')).pathname).toBe('/fr/YuGiOh/Products/Search');
    expect(new URL(cardmarketSearchUrl('X', {}, 'it')).pathname).toBe('/it/YuGiOh/Products/Search');
  });

  it('retombe sur l’anglais pour une langue qu’ils n’ont pas', () => {
    expect(new URL(cardmarketSearchUrl('X', {}, 'pt')).pathname).toBe('/en/YuGiOh/Products/Search');
  });
});

describe('cardmarketWantsUrl', () => {
  it('pointe les listes de souhaits', () => {
    expect(cardmarketWantsUrl('fr')).toBe('https://www.cardmarket.com/fr/YuGiOh/Wants');
    expect(cardmarketWantsUrl('pt')).toBe('https://www.cardmarket.com/en/YuGiOh/Wants');
  });
});

describe('wantsListText', () => {
  it('écrit une ligne par carte, quantité en tête', () => {
    expect(
      wantsListText([
        { nameEn: 'Pot of Greed', quantity: 1 },
        { nameEn: 'Dark Magician', quantity: 3 },
      ]),
    ).toBe('3 Dark Magician\n1 Pot of Greed');
  });

  it('cumule une carte demandée deux fois', () => {
    expect(
      wantsListText([
        { nameEn: 'Called by the Grave', quantity: 2 },
        { nameEn: 'Called by the Grave', quantity: 1 },
      ]),
    ).toBe('3 Called by the Grave');
  });

  it('ignore ce qui ne manque pas', () => {
    expect(
      wantsListText([
        { nameEn: 'Ash Blossom & Joyous Spring', quantity: 0 },
        { nameEn: 'Effect Veiler', quantity: -1 },
        { nameEn: 'Nibiru, the Primal Being', quantity: 1 },
      ]),
    ).toBe('1 Nibiru, the Primal Being');
  });

  it('ne rend rien quand il ne manque rien', () => {
    expect(wantsListText([])).toBe('');
  });

  it('range toujours pareil', () => {
    const cards = [
      { nameEn: 'Zombie World', quantity: 1 },
      { nameEn: 'Allure of Darkness', quantity: 2 },
    ];
    expect(wantsListText(cards)).toBe(wantsListText([...cards].reverse()));
  });
});

describe('marketName', () => {
  it('préfère l’anglais quand la carte est affichée traduite', () => {
    expect(
      marketName({ name: 'Dragon Blanc aux Yeux Bleus', nameEn: 'Blue-Eyes White Dragon' }),
    ).toBe('Blue-Eyes White Dragon');
  });

  // Pas de `nameEn` = le nom affiché est déjà l'anglais, pas « on ne sait pas ».
  it('se contente du nom affiché quand il n’y a rien d’autre', () => {
    expect(marketName({ name: 'Pot of Greed' })).toBe('Pot of Greed');
  });
});
