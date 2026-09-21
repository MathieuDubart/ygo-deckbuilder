import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valide et transforme l'input avec un schéma zod de @ygo/shared.
 * Les mêmes schémas valident les formulaires côté web → une seule source de vérité.
 *
 *   @Body(new ZodValidationPipe(createDeckSchema)) dto: CreateDeckInput
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation échouée',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}
