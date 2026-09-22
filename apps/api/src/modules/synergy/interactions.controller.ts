import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InteractionsService } from './interactions.service';

/** Exploration d'une carte (public ; connecté → ses cartes passent en premier). */
@Public()
@Controller('cards')
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Get(':id/interactions')
  forCard(@Param('id', ParseIntPipe) id: number, @CurrentUser() user?: AuthUser) {
    return this.interactions.forCard(id, user?.id);
  }
}
