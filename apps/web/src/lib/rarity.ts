/**
 * Une seule chose brille dans l'interface : la rareté. Tout le reste est mat.
 *
 * Les noms de rareté viennent du catalogue en anglais et ne sont pas normalisés (« Ultra
 * Rare », « Prismatic Ultimate Rare », « Quarter Century Secret Rare »…), d'où une détection
 * par mot-clé plutôt qu'une liste fermée qui serait périmée à la prochaine extension.
 */
const PREMIUM = [
  'ultra',
  'secret',
  'ultimate',
  'ghost',
  'starlight',
  'collector',
  'platinum',
  'gold',
  'prismatic',
  'serial',
];

/** La rareté mérite-t-elle l'or ? */
export function isPremiumRarity(rarity: string | null | undefined): boolean {
  if (!rarity) return false;
  const value = rarity.toLowerCase();
  return PREMIUM.some((word) => value.includes(word));
}
