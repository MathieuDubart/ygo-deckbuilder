import { describe, expect, it } from 'vitest';
import { categoryOf, isExtraDeck, mapCard, mapPrint, parsePrice } from './ygoprodeck.mapper';

describe('ygoprodeck mapper', () => {
  it('détermine la catégorie', () => {
    expect(categoryOf({ type: 'Quick-Play Spell Card', frameType: 'spell' })).toBe('SPELL');
    expect(categoryOf({ type: 'Counter Trap Card', frameType: 'trap' })).toBe('TRAP');
    expect(categoryOf({ type: 'XYZ Monster', frameType: 'xyz' })).toBe('MONSTER');
    expect(categoryOf({ type: 'Token', frameType: 'token' })).toBe('TOKEN');
  });

  it('détecte les monstres extra deck, pendules inclus', () => {
    expect(isExtraDeck('fusion')).toBe(true);
    expect(isExtraDeck('synchro_pendulum')).toBe(true);
    expect(isExtraDeck('effect_pendulum')).toBe(false);
  });

  it('ignore les prix nuls', () => {
    expect(parsePrice('0.00')).toBeNull();
    expect(parsePrice('1.5')).toBe('1.50');
  });

  it('mappe une carte complète', () => {
    const card = mapCard(
      {
        id: 89631139,
        name: 'Blue-Eyes White Dragon',
        type: 'Normal Monster',
        frameType: 'normal',
        desc: 'This legendary dragon...',
        atk: 3000,
        def: 2500,
        level: 8,
        race: 'Dragon',
        attribute: 'LIGHT',
        archetype: 'Blue-Eyes',
        card_images: [{ id: 89631139, image_url: 'big.jpg', image_url_small: 'small.jpg' }],
        card_prices: [{ cardmarket_price: '0.12' }],
        misc_info: [{ formats: ['TCG', 'OCG'], tcg_date: '2002-03-08' }],
      },
      { name: 'Dragon Blanc aux Yeux Bleus', desc: 'Ce dragon légendaire...' },
    );
    expect(card).toMatchObject({
      category: 'MONSTER',
      nameFr: 'Dragon Blanc aux Yeux Bleus',
      isExtraDeck: false,
      priceCardmarket: '0.12',
      imageUrlSmall: 'small.jpg',
      formats: ['TCG', 'OCG'],
    });
  });

  it('nettoie le code de rareté', () => {
    expect(
      mapPrint(1, {
        set_name: 'X',
        set_code: 'LOB-EN001',
        set_rarity: 'Ultra Rare',
        set_rarity_code: '(UR)',
      }),
    ).toMatchObject({ rarityCode: 'UR', printCode: 'LOB-EN001' });
  });
});
