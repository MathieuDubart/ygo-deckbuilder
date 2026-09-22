import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType, core } from 'zod';
import { t } from '../i18n/locale-context';

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
        message: t('errors.validation'),
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: localize(i) })),
      });
    }
    return result.data;
  }
}

/** Message d'erreur de validation dans la langue de la requête, selon le type d'erreur zod. */
function localize(issue: core.$ZodIssue): string {
  switch (issue.code) {
    case 'too_small':
      return t(issue.origin === 'string' ? 'validation.minChars' : 'validation.min', {
        min: String(issue.minimum),
      });
    case 'too_big':
      return t(issue.origin === 'string' ? 'validation.maxChars' : 'validation.max', {
        max: String(issue.maximum),
      });
    case 'invalid_format':
      return t(
        issue.format === 'email'
          ? 'validation.email'
          : issue.format === 'regex'
            ? 'validation.pattern'
            : 'validation.format',
      );
    case 'invalid_type':
      return t(issue.input === undefined ? 'validation.required' : 'validation.invalid');
    default:
      return t('validation.invalid');
  }
}
