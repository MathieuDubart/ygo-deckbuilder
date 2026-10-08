import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { type BanlistStatusDto } from '@ygo/shared';
import { CronJob } from 'cron';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import { YgoprodeckClient } from '../catalog-sync/ygoprodeck.client';
import { banlistWrites, countChanges, indexByCard } from './banlist.diff';
import { parseBanlist, type BanlistEntry, type BanlistFormat } from './banlist.parser';

/** État de relecture, dans la même table que les autres synchros. */
const SYNC_ID = 'ygoprodeck-banlist';

/**
 * La banlist change bien plus souvent que le reste du catalogue, et une liste périmée fait
 * construire des decks illégaux. On la relit donc à part : `cardinfo.php?banlist=…` ne renvoie
 * que les ~150 cartes concernées, là où la synchro du catalogue tire 13 000 cartes et tourne
 * une fois par jour.
 *
 * Deux déclencheurs : un cron, et l'ouverture d'un deck côté client — bornée par un âge
 * minimum, pour qu'ouvrir dix decks d'affilée ne fasse pas dix requêtes.
 */
@Injectable()
export class BanlistService implements OnModuleInit {
  private readonly logger = new Logger(BanlistService.name);
  /**
   * Relecture en cours. Les appels concurrents attendent la même, au lieu d'en lancer une
   * chacun : à l'ouverture d'un deck, plusieurs onglets peuvent demander en même temps.
   */
  private inFlight: Promise<BanlistStatusDto> | null = null;
  /**
   * Après un échec, moment avant lequel on ne retente pas. Une lecture ratée ne doit NI passer
   * pour une lecture réussie (sinon la liste serait réputée fraîche pendant des heures), ni
   * laisser chaque ouverture de deck relancer une requête vers une source injoignable.
   */
  private retryAfter = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ygoprodeck: YgoprodeckClient,
    private readonly config: AppConfig,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const cron = this.config.get('BANLIST_CRON');
    if (!cron) return;
    const job = CronJob.from({
      cronTime: cron,
      onTick: () => void this.refresh().catch((e) => this.logger.error(e)),
    });
    this.scheduler.addCronJob('banlist', job);
    job.start();
  }

  async status(): Promise<BanlistStatusDto> {
    const state = await this.prisma.syncState.findUnique({ where: { id: SYNC_ID } });
    return {
      changed: false,
      checkedAt: state?.lastSyncAt?.toISOString() ?? null,
      listed: state?.cardCount ?? 0,
    };
  }

  /**
   * Relit la banlist si la dernière lecture a dépassé `BANLIST_MAX_AGE_MINUTES`, sinon renvoie
   * l'état connu. C'est ce que le client appelle en ouvrant un deck : jamais bloquant pour lui
   * (il affiche le deck d'abord), et sans coût quand la liste est fraîche.
   */
  async refreshIfStale(): Promise<BanlistStatusDto> {
    const current = await this.status();
    const maxAge = this.config.get('BANLIST_MAX_AGE_MINUTES') * 60_000;
    if (current.checkedAt && Date.now() - Date.parse(current.checkedAt) < maxAge) return current;
    if (Date.now() < this.retryAfter) return current;
    return this.refresh();
  }

  /** Relit les deux listes et aligne la base. Renvoie `changed` si un statut a bougé. */
  async refresh(): Promise<BanlistStatusDto> {
    this.inFlight ??= this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async run(): Promise<BanlistStatusDto> {
    try {
      const [tcg, ocg] = await Promise.all([this.read('tcg'), this.read('ocg')]);
      const changed = await this.apply(tcg, ocg);
      const listed = new Set([...tcg, ...ocg].map((e) => e.cardId)).size;
      await this.saveSuccess(listed);
      this.retryAfter = 0;
      if (changed) this.logger.log(`Banlist : ${changed} statut(s) modifié(s), ${listed} cartes`);
      return { changed: changed > 0, checkedAt: new Date().toISOString(), listed };
    } catch (e) {
      this.retryAfter = Date.now() + this.config.get('BANLIST_RETRY_MINUTES') * 60_000;
      await this.saveFailure(String(e));
      throw e;
    }
  }

  private async read(format: BanlistFormat): Promise<BanlistEntry[]> {
    return parseBanlist(await this.ygoprodeck.banlist(format), format);
  }

  /**
   * Aligne `banTcg` / `banOcg` sur les listes reçues. La décision de ce qu'il faut écrire — et
   * surtout de ce qu'il faut EFFACER — vit dans `banlistWrites`, pure et testée : c'est le seul
   * endroit de l'app qui peut faire disparaître un statut en silence.
   */
  private async apply(tcg: BanlistEntry[], ocg: BanlistEntry[]): Promise<number> {
    const listed = { banTcg: indexByCard(tcg), banOcg: indexByCard(ocg) };
    // Les cartes qui portent un statut aujourd'hui, plus celles qui devraient en porter un : la
    // différence des deux ensembles donne exactement ce qu'il y a à écrire.
    const current = await this.prisma.card.findMany({
      where: {
        OR: [
          { banTcg: { not: null } },
          { banOcg: { not: null } },
          { id: { in: [...listed.banTcg.keys(), ...listed.banOcg.keys()] } },
        ],
      },
      select: { id: true, banTcg: true, banOcg: true },
    });

    const writes = banlistWrites(current, listed);
    for (const { column, label, cardIds } of writes) {
      await this.prisma.card.updateMany({
        where: { id: { in: cardIds } },
        data: { [column]: label },
      });
    }
    return countChanges(writes);
  }

  private async saveSuccess(count: number): Promise<void> {
    const data = { lastSyncAt: new Date(), lastStatus: 'OK', lastError: null, cardCount: count };
    await this.prisma.syncState.upsert({
      where: { id: SYNC_ID },
      create: { id: SYNC_ID, ...data },
      update: data,
    });
  }

  /**
   * Un échec note l'erreur mais ne touche NI `lastSyncAt` NI `cardCount` : la dernière lecture
   * réussie reste la référence, et la liste qu'on a en base reste la meilleure connue.
   */
  private async saveFailure(error: string): Promise<void> {
    const data = { lastStatus: 'ERROR', lastError: error };
    await this.prisma.syncState.upsert({
      where: { id: SYNC_ID },
      create: { id: SYNC_ID, ...data, cardCount: 0 },
      update: data,
    });
  }
}
