import { describe, expect, it } from 'vitest';
import { cardStrings, parseStringsConf, toCardData, type CdbDataRow } from './cdb';

const row = (over: Partial<CdbDataRow>): CdbDataRow => ({
  id: 1n,
  alias: 0n,
  setcode: 0n,
  type: 0x21n, // Monstre à effet
  atk: 1000n,
  def: 800n,
  level: 4n,
  race: 0x1n,
  attribute: 0x10n,
  ...over,
});

describe('toCardData', () => {
  it('sépare les archétypes empilés sur 16 bits', () => {
    expect(toCardData(row({ setcode: 0x00dd_0102_00e3n })).setcodes).toEqual([0xe3, 0x102, 0xdd]);
  });

  it('lit les Échelles Pendule sur les octets hauts du Niveau', () => {
    // Magicien des Ténèbres Pendule-like : Échelle 8/8, Niveau 4
    const data = toCardData(row({ level: 0x0808_0004n, type: 0x1000021n }));
    expect(data.level).toBe(4);
    expect(data.lscale).toBe(8);
    expect(data.rscale).toBe(8);
  });

  it('prend les Flèches Lien dans la DEF des Monstres Lien', () => {
    const data = toCardData(row({ type: 0x4000021n, def: 0b1010_0000n, level: 2n }));
    expect(data.link_marker).toBe(0b1010_0000);
    expect(data.defense).toBe(0);
    expect(data.level).toBe(2);
  });

  it('garde la race en 64 bits', () => {
    expect(toCardData(row({ race: 1n << 40n })).race).toBe(1n << 40n);
  });
});

describe('cardStrings', () => {
  it('renvoie toujours 16 textes', () => {
    const strings = cardStrings({ id: 1n, name: 'x', desc: '', str1: 'Search', str3: 'Draw' });
    expect(strings).toHaveLength(16);
    expect(strings[0]).toBe('Search');
    expect(strings[1]).toBe('');
    expect(strings[2]).toBe('Draw');
  });
});

describe('parseStringsConf', () => {
  it('lit les textes système et les raisons de victoire', () => {
    const { system, victory } = parseStringsConf(
      '#comment\n!system 1150 Activate\r\n!victory 0x10 Exodia\n!setname 0x1 Ally of Justice\n',
    );
    expect(system.get(1150)).toBe('Activate');
    expect(victory.get(0x10)).toBe('Exodia');
    expect(system.size).toBe(1);
  });
});
