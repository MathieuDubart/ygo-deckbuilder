import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTagInput, TagDto, UpdateTagInput } from '@ygo/shared';
import { t } from '../../common/i18n/locale-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

const withCounts = {
  id: true,
  name: true,
  color: true,
  _count: { select: { cards: true, sets: true } },
} satisfies Prisma.TagSelect;

type TagRow = Prisma.TagGetPayload<{ select: typeof withCounts }>;

/**
 * Étiquettes personnelles : des mots que l'utilisateur colle sur ses cartes et ses extensions
 * pour s'y retrouver à sa façon. Rien à voir avec les facettes (archétype, rareté, année…),
 * qui se déduisent du catalogue et n'ont pas besoin d'être saisies.
 */
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<TagDto[]> {
    const rows = await this.prisma.tag.findMany({
      where: { userId },
      select: withCounts,
      orderBy: { name: 'asc' },
    });
    return rows.map(toTagDto);
  }

  async create(userId: string, input: CreateTagInput): Promise<TagDto> {
    const name = input.name.trim();
    const existing = await this.prisma.tag.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
      select: withCounts,
    });
    if (existing) throw new ConflictException(t('errors.tagExists'));
    const row = await this.prisma.tag.create({
      data: { userId, name, color: input.color },
      select: withCounts,
    });
    return toTagDto(row);
  }

  async update(userId: string, id: string, input: UpdateTagInput): Promise<TagDto> {
    await this.own(userId, id);
    if (input.name) {
      const clash = await this.prisma.tag.findFirst({
        where: {
          userId,
          id: { not: id },
          name: { equals: input.name.trim(), mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (clash) throw new ConflictException(t('errors.tagExists'));
    }
    const row = await this.prisma.tag.update({
      where: { id },
      data: { name: input.name?.trim(), color: input.color },
      select: withCounts,
    });
    return toTagDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.own(userId, id);
    await this.prisma.tag.delete({ where: { id } });
  }

  /** Pose ou retire l'étiquette sur une carte. Idempotent : reposer ne crée pas de doublon. */
  async setCard(userId: string, id: string, cardId: number, on: boolean): Promise<TagDto> {
    await this.own(userId, id);
    if (on) {
      const card = await this.prisma.card.findUnique({
        where: { id: cardId },
        select: { id: true },
      });
      if (!card) throw new NotFoundException(t('errors.cardNotFound'));
      await this.prisma.cardTag.createMany({ data: [{ tagId: id, cardId }], skipDuplicates: true });
    } else {
      await this.prisma.cardTag.deleteMany({ where: { tagId: id, cardId } });
    }
    return this.one(id);
  }

  /** Pose ou retire l'étiquette sur une extension (qu'on la possède ou non). */
  async setSet(userId: string, id: string, setId: string, on: boolean): Promise<TagDto> {
    await this.own(userId, id);
    if (on) {
      const set = await this.prisma.cardSet.findUnique({
        where: { id: setId },
        select: { id: true },
      });
      if (!set) throw new NotFoundException(t('errors.productNotFound'));
      await this.prisma.setTag.createMany({ data: [{ tagId: id, setId }], skipDuplicates: true });
    } else {
      await this.prisma.setTag.deleteMany({ where: { tagId: id, setId } });
    }
    return this.one(id);
  }

  private async own(userId: string, id: string): Promise<void> {
    const tag = await this.prisma.tag.findFirst({ where: { id, userId }, select: { id: true } });
    if (!tag) throw new NotFoundException(t('errors.tagNotFound'));
  }

  private async one(id: string): Promise<TagDto> {
    const row = await this.prisma.tag.findUniqueOrThrow({ where: { id }, select: withCounts });
    return toTagDto(row);
  }
}

function toTagDto(row: TagRow): TagDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color as TagDto['color'],
    cardCount: row._count.cards,
    setCount: row._count.sets,
  };
}
