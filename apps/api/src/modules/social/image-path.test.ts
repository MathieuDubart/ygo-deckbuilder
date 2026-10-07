import { describe, expect, it } from 'vitest';
import { isProfileImagePath, profileImagePath } from './image-path';

const TOKEN = '0123456789abcdef';

describe('profileImagePath', () => {
  it('produit un chemin accepté par son propre validateur', () => {
    const path = profileImagePath('avatar', 'ckl3n2x9a0000', TOKEN);
    expect(path).toBe('profile/ckl3n2x9a0000/avatar-0123456789abcdef.webp');
    expect(isProfileImagePath(path)).toBe(true);
    expect(isProfileImagePath(profileImagePath('banner', 'ckl3n2x9a0000', TOKEN))).toBe(true);
  });
});

describe('isProfileImagePath', () => {
  it('refuse toute remontée de dossier', () => {
    expect(isProfileImagePath('profile/../../etc/passwd')).toBe(false);
    expect(isProfileImagePath('profile/u1/../../../etc/passwd')).toBe(false);
    expect(isProfileImagePath(`profile/..%2f..%2fetc/avatar-${TOKEN}.webp`)).toBe(false);
    expect(isProfileImagePath(`profile/u1/avatar-${TOKEN}.webp/../../x`)).toBe(false);
  });

  it('refuse un chemin absolu ou un séparateur Windows', () => {
    expect(isProfileImagePath(`/profile/u1/avatar-${TOKEN}.webp`)).toBe(false);
    expect(isProfileImagePath(`profile\\u1\\avatar-${TOKEN}.webp`)).toBe(false);
    expect(isProfileImagePath('/etc/passwd')).toBe(false);
  });

  it('refuse une autre extension, même avec la bonne forme', () => {
    expect(isProfileImagePath(`profile/u1/avatar-${TOKEN}.svg`)).toBe(false);
    expect(isProfileImagePath(`profile/u1/avatar-${TOKEN}.php`)).toBe(false);
    expect(isProfileImagePath(`profile/u1/avatar-${TOKEN}.webp.svg`)).toBe(false);
  });

  it('refuse un identifiant ou un jeton hors format', () => {
    expect(isProfileImagePath(`profile/u 1/avatar-${TOKEN}.webp`)).toBe(false);
    expect(isProfileImagePath(`profile//avatar-${TOKEN}.webp`)).toBe(false);
    expect(isProfileImagePath('profile/u1/avatar-xyz.webp')).toBe(false);
    expect(isProfileImagePath('profile/u1/avatar-0123456789abcde.webp')).toBe(false);
    expect(isProfileImagePath(`profile/u1/cover-${TOKEN}.webp`)).toBe(false);
    expect(isProfileImagePath(`profile/u1/sub/avatar-${TOKEN}.webp`)).toBe(false);
  });

  it('refuse le vide et les octets nuls', () => {
    expect(isProfileImagePath('')).toBe(false);
    expect(isProfileImagePath(`profile/u1/avatar-${TOKEN}.webp\u0000.svg`)).toBe(false);
  });
});
