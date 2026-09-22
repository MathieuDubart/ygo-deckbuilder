/**
 * Code source de l'application (AGPL-3.0, §13 : proposé aux utilisateurs du service).
 * Une instance modifiée doit pointer vers son propre dépôt (variable lue au build).
 */
export const SOURCE_URL =
  process.env.NEXT_PUBLIC_SOURCE_URL || 'https://github.com/MathieuDubart/ygo-deckbuilder';
