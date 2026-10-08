/**
 * État de la banlist locale. `changed` dit si la dernière relecture a bougé un statut : c'est
 * le seul signal dont le client a besoin pour décider de recharger un deck ou pas.
 */
export interface BanlistStatusDto {
  changed: boolean;
  /** Dernière relecture, ou `null` si la banlist n'a jamais été lue. */
  checkedAt: string | null;
  /** Nombre de cartes sur l'une des deux listes. */
  listed: number;
}
