import { BadGatewayException, Controller, Get, Post } from '@nestjs/common';
import { t } from '../../common/i18n/locale-context';
import { BanlistService } from './banlist.service';

@Controller('banlist')
export class BanlistController {
  constructor(private readonly banlist: BanlistService) {}

  /** Date de la dernière relecture, sans rien déclencher. */
  @Get('status')
  status() {
    return this.banlist.status();
  }

  /**
   * Relit la banlist si elle a vieilli. Appelé à l'ouverture d'un deck : la réponse dit si un
   * statut a bougé, ce qui permet au client de recharger le deck seulement quand c'est utile.
   * Une liste fraîche ne coûte qu'une lecture en base.
   */
  @Post('refresh')
  async refresh() {
    try {
      return await this.banlist.refreshIfStale();
    } catch (e) {
      throw new BadGatewayException(t('errors.banlistFailed', { message: (e as Error).message }));
    }
  }
}
