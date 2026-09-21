/**
 * Code d'impression tel qu'écrit sur la carte physique : "SDBE-FR001", "LOB-EN001", "MP22-FR266"…
 * On garde le préfixe du set et le numéro, SANS la langue : YGOPRODeck ne stocke que les
 * impressions EN, mais le numéro est identique d'une langue à l'autre.
 */
export function parsePrintCode(q: string): { set: string; number: string } | null {
  const m = /^\s*([a-z0-9]{2,5})-([a-z]{0,2})(\d{2,4})\s*$/i.exec(q);
  return m ? { set: m[1]!.toUpperCase(), number: m[3]! } : null;
}

/** "SDBE-EN001" correspond-il au code tapé "sdbe-fr001" ? */
export function matchesPrintCode(
  printCode: string,
  code: { set: string; number: string },
): boolean {
  const parsed = parsePrintCode(printCode);
  return !!parsed && parsed.set === code.set && parsed.number === code.number;
}
