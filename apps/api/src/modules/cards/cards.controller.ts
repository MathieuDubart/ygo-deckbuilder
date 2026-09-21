import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  cardSearchSchema,
  setSearchSchema,
  type CardSearchInput,
  type SetSearchInput,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CardsService } from './cards.service';

/** Catalogue public ; si l'utilisateur est connecté, on enrichit avec ses quantités possédées. */
@Public()
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  search(
    @Query(new ZodValidationPipe(cardSearchSchema)) query: CardSearchInput,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.cards.search(query, user?.id);
  }

  @Get('archetypes')
  archetypes() {
    return this.cards.archetypes();
  }

  @Get('sets')
  sets(@Query(new ZodValidationPipe(setSearchSchema)) query: SetSearchInput) {
    return this.cards.sets(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user?: AuthUser) {
    return this.cards.findOne(id, user?.id);
  }
}
