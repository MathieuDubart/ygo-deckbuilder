import { describe, expect, it } from 'vitest';
import { parseYdk, toYdk } from './ydk';

describe('parseYdk', () => {
  it('regroupe les exemplaires par zone', () => {
    const ydk = '#created by test\n#main\n1\n1\n2\n#extra\n3\n!side\n1\n';
    expect(parseYdk(ydk)).toEqual([
      { cardId: 1, zone: 'MAIN', quantity: 2 },
      { cardId: 2, zone: 'MAIN', quantity: 1 },
      { cardId: 3, zone: 'EXTRA', quantity: 1 },
      { cardId: 1, zone: 'SIDE', quantity: 1 },
    ]);
  });

  it('fait un aller-retour avec toYdk', () => {
    const entries = parseYdk('#main\n5\n5\n#extra\n!side\n6\n');
    expect(parseYdk(toYdk(entries))).toEqual(entries);
  });
});
