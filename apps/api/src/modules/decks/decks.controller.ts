import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createDeckSchema,
  importYdkSchema,
  updateDeckSchema,
  type CreateDeckInput,
  type ImportYdkInput,
  type UpdateDeckInput,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DecksService } from './decks.service';

@Controller('decks')
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.decks.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDeckSchema)) body: CreateDeckInput,
  ) {
    return this.decks.create(user.id, body);
  }

  @Post('import-ydk')
  importYdk(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(importYdkSchema)) body: ImportYdkInput,
  ) {
    return this.decks.importYdk(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.decks.get(user.id, id);
  }

  @Get(':id/export.ydk')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  exportYdk(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.decks.exportYdk(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDeckSchema)) body: UpdateDeckInput,
  ) {
    return this.decks.update(user.id, id, body);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.decks.duplicate(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.decks.remove(user.id, id);
  }
}
