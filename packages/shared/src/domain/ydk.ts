import type { DeckZone } from './enums';

export interface ParsedYdkEntry {
  cardId: number;
  zone: DeckZone;
  quantity: number;
}

/**
 * Parse un fichier .ydk (format standard YGOPro / EDOPro / Master Duel exports) :
 *
 *   #created by ...
 *   #main
 *   89631139
 *   89631139
 *   #extra
 *   ...
 *   !side
 *   ...
 */
export function parseYdk(content: string): ParsedYdkEntry[] {
  const counts = new Map<string, ParsedYdkEntry>();
  let zone: DeckZone | null = null;

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower === '#main') zone = 'MAIN';
    else if (lower === '#extra') zone = 'EXTRA';
    else if (lower === '!side') zone = 'SIDE';
    else if (line.startsWith('#') || line.startsWith('!')) continue;
    else if (zone && /^\d+$/.test(line)) {
      const cardId = Number(line);
      const key = `${zone}:${cardId}`;
      const entry = counts.get(key);
      if (entry) entry.quantity += 1;
      else counts.set(key, { cardId, zone, quantity: 1 });
    }
  }
  return [...counts.values()];
}

export function toYdk(entries: ParsedYdkEntry[], author = 'ygo-deckbuilder'): string {
  const section = (zone: DeckZone) =>
    entries
      .filter((e) => e.zone === zone)
      .flatMap((e) => Array.from({ length: e.quantity }, () => String(e.cardId)));
  return [
    `#created by ${author}`,
    '#main',
    ...section('MAIN'),
    '#extra',
    ...section('EXTRA'),
    '!side',
    ...section('SIDE'),
    '',
  ].join('\n');
}
