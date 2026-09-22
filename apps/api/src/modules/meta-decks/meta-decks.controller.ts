import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { importMetaDeckSchema, type ImportMetaDeckInput } from '@ygo/shared';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MetaDecksService } from './meta-decks.service';
import { MetaSyncService } from './meta-sync.service';

@Controller('meta-decks')
export class MetaDecksController {
  constructor(
    private readonly meta: MetaDecksService,
    private readonly metaSync: MetaSyncService,
  ) {}

  @Public()
  @Get()
  list() {
    return this.meta.list();
  }

  @Public()
  @Get('status')
  status() {
    return this.metaSync.status();
  }

  /** Récupère les listes de tournoi récentes et recalcule le meta (admin, ~20 s). */
  @Roles('ADMIN')
  @Post('sync')
  sync() {
    return this.metaSync.sync();
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.meta.get(id);
  }

  @Roles('ADMIN')
  @Post('import-ydk')
  import(@Body(new ZodValidationPipe(importMetaDeckSchema)) body: ImportMetaDeckInput) {
    return this.meta.importYdk(body);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.meta.remove(id);
  }
}
