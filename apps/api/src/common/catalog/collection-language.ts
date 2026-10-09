import { CARD_LANGUAGES, type CardLanguage } from '@ygo/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { currentLocale } from '../i18n/locale-context';

/**
 * La langue dans laquelle ranger une carte qui arrive dans la collection.
 *
 * Trois sources, dans cet ordre : ce que le client a explicitement demandé (il sait des choses
 * qu'on ignore — la carte en main peut être dans une autre langue que les autres), le réglage
 * de l'utilisateur, et à défaut la langue de sa requête. Le dernier recours n'est pas un
 * défaut figé : « FR » pour tout le monde est précisément ce qui mélangeait les collections.
 */
export async function collectionLanguageOf(
  prisma: PrismaService,
  userId: string,
  explicit?: CardLanguage,
): Promise<CardLanguage> {
  if (explicit) return explicit;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { collectionLanguage: true },
  });
  return user?.collectionLanguage ?? localeLanguage();
}

/** La langue de la requête lue comme une langue de carte, anglais si elle n'en est pas une. */
export const localeLanguage = (): CardLanguage =>
  CARD_LANGUAGES.find((l) => l === currentLocale().toUpperCase()) ?? 'EN';
