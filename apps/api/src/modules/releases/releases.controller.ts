import { Controller, Get, Param, Query } from '@nestjs/common';
import { releaseQuerySchema, type ReleaseQueryInput } from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReleasesService } from './releases.service';

/**
 * Suivi par extension. Rangé sous `collection` : c'est un onglet de la collection, et le
 * client natif y trouve ses routes au même endroit que les cartes et les produits.
 */
@Controller('collection/releases')
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(releaseQuerySchema)) q: ReleaseQueryInput,
  ) {
    return this.releases.list(user.id, q);
  }

  /** Sorties à venir et sorties récentes, mises en avant en haut de l'onglet. */
  @Get('spotlight')
  spotlight(@CurrentUser() user: AuthUser) {
    return this.releases.spotlight(user.id);
  }

  @Get('facets')
  facets() {
    return this.releases.facets();
  }

  @Get(':setId')
  detail(@CurrentUser() user: AuthUser, @Param('setId') setId: string) {
    return this.releases.detail(user.id, setId);
  }
}
