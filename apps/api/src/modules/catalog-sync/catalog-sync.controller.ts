import { BadGatewayException, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CatalogSyncService } from './catalog-sync.service';

@Controller('catalog')
export class CatalogSyncController {
  constructor(private readonly sync: CatalogSyncService) {}

  @Public()
  @Get('status')
  status() {
    return this.sync.status();
  }

  /** Déclenche une sync (admin). Longue (~1-3 min) : la réponse arrive à la fin. */
  @Roles('ADMIN')
  @Post('sync')
  async run(@Query('force') force?: string) {
    try {
      return await this.sync.sync({ force: force === 'true' });
    } catch (e) {
      throw new BadGatewayException(`Synchronisation échouée : ${(e as Error).message}`);
    }
  }
}
