import type { ProfileImageKind } from '@ygo/shared';

/**
 * Chemins des images de profil. Logique pure et volontairement rigide : ces chemins viennent
 * de la base, mais sont servis depuis le disque, donc c'est le seul endroit où une donnée
 * utilisateur se transforme en accès fichier. Un format fermé vaut mieux qu'un nettoyage.
 */

const PATTERN = /^profile\/[A-Za-z0-9_-]{1,40}\/(avatar|banner)-[a-f0-9]{16}\.webp$/;

export function profileImagePath(kind: ProfileImageKind, userId: string, token: string): string {
  return `profile/${userId}/${kind}-${token}.webp`;
}

/**
 * Un chemin est servable s'il a exactement la forme qu'on génère. Tout le reste est refusé —
 * `..`, les chemins absolus et les séparateurs Windows n'ont même pas besoin d'être traités.
 */
export function isProfileImagePath(value: string): boolean {
  return PATTERN.test(value);
}

/** Taille et cadrage de chaque image, appliqués au réencodage. */
export const IMAGE_SPECS: Record<ProfileImageKind, { width: number; height: number }> = {
  avatar: { width: 512, height: 512 },
  banner: { width: 1600, height: 500 },
};
