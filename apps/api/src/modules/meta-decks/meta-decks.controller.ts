import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { importMetaDeckSchema, type ImportMetaDeckInput } from '@ygo/shared';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MetaDecksService } from './meta-decks.service';

@Controller('meta-decks')
export class MetaDecksController {
  constructor(private readonly meta: MetaDecksService) {}

  @Public()
  @Get()
  list() {
    return this.meta.list();
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
