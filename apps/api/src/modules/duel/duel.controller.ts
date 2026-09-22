import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  createDuelSchema,
  duelResponseSchema,
  duelSettingsSchema,
  type CreateDuelInput,
  type DuelEngineStatusDto,
  type DuelResponseInput,
  type DuelSettingsInput,
  type DuelStateDto,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DuelService } from './duel.service';

/**
 * Simulateur de duel. Pas de WebSocket : chaque réponse renvoie l'état, les nouveaux
 * événements et le prochain choix (l'adversaire passif ou le bot jouent côté serveur).
 */
@Controller('duels')
export class DuelController {
  constructor(private readonly duels: DuelService) {}

  @Get('engine')
  engine(): DuelEngineStatusDto {
    return this.duels.status();
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDuelSchema)) body: CreateDuelInput,
  ): Promise<DuelStateDto> {
    return this.duels.create(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<DuelStateDto> {
    return this.duels.get(user.id, id);
  }

  @Post(':id/respond')
  @HttpCode(200)
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(duelResponseSchema)) body: DuelResponseInput,
  ): Promise<DuelStateDto> {
    return this.duels.respond(user.id, id, body);
  }

  @Patch(':id')
  settings(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(duelSettingsSchema)) body: DuelSettingsInput,
  ): Promise<DuelStateDto> {
    return this.duels.settings(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): void {
    this.duels.remove(user.id, id);
  }
}
