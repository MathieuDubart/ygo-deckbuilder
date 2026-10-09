import { z } from 'zod';
import { TAG_COLORS, type TagColor } from '../domain/enums';

/**
 * Étiquettes personnelles : des mots qu'on colle soi-même sur une carte ou une extension
 * (« à vendre », « doublons », « deck Blue-Eyes »). À ne pas confondre avec les facettes de
 * tri (archétype, rareté, année…), qui sont calculées depuis le catalogue.
 */
export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(TAG_COLORS).default('slate'),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = createTagSchema.partial();
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

/**
 * Identifiants d'étiquettes dans une query string. Accepte `tagIds=a,b` comme
 * `tagIds=a&tagIds=b` : les deux formes circulent selon le client.
 */
export const tagIdsSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
  .pipe(z.array(z.string().max(40)).max(20));

export interface TagDto {
  id: string;
  name: string;
  color: TagColor;
  /** Cartes portant cette étiquette (toutes impressions confondues). */
  cardCount: number;
  /** Extensions portant cette étiquette. */
  setCount: number;
  /** Decks portant cette étiquette. */
  deckCount: number;
}
