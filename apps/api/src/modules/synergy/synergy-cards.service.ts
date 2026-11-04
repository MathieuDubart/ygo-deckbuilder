import { Injectable } from '@nestjs/common';
import { isTcgLegal } from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { GenCardInfo } from '../meta-decks/engine/generator';
import type { SynCard } from './engine/types';

/** Carte avec tout ce qu'il faut pour construire un deck ET lire ses effets. */
export type FullCard = SynCard & GenCardInfo;

export const synCardSelect = {
  id: true,
  name: true,
  desc: true,
  type: true,
  frameType: true,
  category: true,
  race: true,
  attribute: true,
  level: true,
  linkVal: true,
  archetype: true,
  isExtraDeck: true,
  banTcg: true,
} as const;

/** Ce qu'il faut en plus pour savoir si la carte se joue en TCG (cf. `isTcgLegal`). */
const legalitySelect = { formats: true, tcgDate: true } as const;

/** Chargement des cartes pour le moteur de synergie (texte anglais officiel compris). */
@Injectable()
export class SynergyCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async load(ids: number[]): Promise<FullCard[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.card.findMany({
      where: { id: { in: ids } },
      select: { ...synCardSelect, ...legalitySelect },
    });
    const today = new Date();
    return rows.map(({ formats, tcgDate, ...card }) => ({
      ...card,
      tcgLegal: isTcgLegal({ formats, tcgDate }, today),
    }));
  }
}
