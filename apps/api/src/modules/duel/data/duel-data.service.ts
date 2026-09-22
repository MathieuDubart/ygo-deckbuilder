import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { OcgCardData } from 'ocgcore-wasm';
import { AppConfig } from '../../../config/app-config.service';
import type { DuelEngineStatusDto } from '@ygo/shared';
import { cardStrings, parseStringsConf, toCardData, type CdbDataRow, type CdbTextRow } from './cdb';

export interface CardText {
  name: string;
  strings: string[];
}

/**
 * Données du moteur de duel (EDOPro / ProjectIgnis), téléchargées au premier démarrage puis
 * mises à jour chaque semaine :
 * - scripts Lua de chaque carte (CardScripts, AGPL-3.0) ;
 * - bases de cartes .cdb (BabelCDB) : types, archétypes, stats et textes des effets ;
 * - strings.conf : textes système (invites, raisons de victoire).
 * Rien n'est versionné dans le dépôt : tout vit dans DUEL_DATA_DIR.
 */
@Injectable()
export class DuelDataService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DuelDataService.name);
  private cards = new Map<number, OcgCardData>();
  private texts = new Map<number, CardText>();
  private system = new Map<number, string>();
  private victory = new Map<number, string>();
  private scriptCache = new Map<string, string | null>();
  private scriptCount = 0;
  private updatedAt: Date | null = null;
  private downloading: Promise<void> | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  get enabled(): boolean {
    return this.config.get('DUEL_ENABLED');
  }

  get root(): string {
    return resolve(this.config.get('DUEL_DATA_DIR'));
  }

  private get scriptsDir(): string {
    return join(this.root, 'scripts');
  }

  private get cdbDir(): string {
    return join(this.root, 'cdb');
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    // Ne bloque pas le démarrage : chargement / téléchargement en arrière-plan
    void this.ensure().catch(() => undefined);
    const cron = this.config.get('DUEL_DATA_CRON');
    if (cron) {
      const job = CronJob.from({
        cronTime: cron,
        onTick: () => void this.refresh().catch(() => undefined),
      });
      this.scheduler.addCronJob('duel-data', job);
      job.start();
    }
  }

  get ready(): boolean {
    return this.cards.size > 0 && this.scriptCount > 0;
  }

  status(): DuelEngineStatusDto {
    return {
      ready: this.ready,
      downloading: this.downloading !== null,
      cards: this.cards.size,
      scripts: this.scriptCount,
      updatedAt: this.updatedAt?.toISOString() ?? null,
      error: this.lastError,
    };
  }

  /** Charge les données présentes sur disque, ou les télécharge si elles manquent. */
  async ensure(): Promise<void> {
    if (this.ready) return;
    if (existsSync(join(this.scriptsDir, 'utility.lua')) && existsSync(this.cdbDir)) {
      await this.load();
      if (this.ready) return;
    }
    await this.refresh();
  }

  /** Télécharge la dernière version des scripts et des bases, puis recharge. */
  refresh(): Promise<void> {
    this.downloading ??= this.download()
      .then(() => this.load())
      .then(() => {
        this.lastError = null;
      })
      .catch((e: Error) => {
        this.lastError = e.message;
        this.logger.warn(`Données du simulateur indisponibles : ${e.message}`);
        throw e;
      })
      .finally(() => {
        this.downloading = null;
      });
    return this.downloading;
  }

  private async download(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const started = Date.now();
    this.logger.log(
      'Simulateur : téléchargement des scripts de cartes et des bases (ProjectIgnis)…',
    );
    const tmp = join(this.root, `.download-${Date.now()}`);
    await mkdir(join(tmp, 'scripts'), { recursive: true });
    await mkdir(join(tmp, 'cdb'), { recursive: true });
    try {
      await this.extract(this.config.get('DUEL_SCRIPTS_URL'), join(tmp, 'scripts'));
      await this.extract(this.config.get('DUEL_CDB_URL'), join(tmp, 'cdb'));
      const strings = await fetch(this.config.get('DUEL_STRINGS_URL'));
      if (!strings.ok) throw new Error(`strings.conf : HTTP ${strings.status}`);
      await writeFile(join(tmp, 'strings.conf'), await strings.text());

      // Remplacement atomique (un duel en cours garde ses scripts déjà lus en mémoire)
      for (const name of ['scripts', 'cdb', 'strings.conf']) {
        await rm(join(this.root, name), { recursive: true, force: true });
        await rename(join(tmp, name), join(this.root, name));
      }
      this.logger.log(
        `Simulateur : données téléchargées en ${Math.round((Date.now() - started) / 1000)} s`,
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }

  /** Archive .tar.gz d'un dépôt GitHub → dossier (sans le dossier racine de l'archive). */
  private async extract(url: string, dir: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url} : HTTP ${res.status}`);
    await new Promise<void>((done, fail) => {
      const tar = spawn('tar', ['-xz', '-C', dir, '--strip-components=1'], {
        stdio: ['pipe', 'ignore', 'pipe'],
      });
      let stderr = '';
      tar.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
      tar.on('error', fail);
      tar.on('close', (code) => (code === 0 ? done() : fail(new Error(`tar : ${stderr || code}`))));
      Readable.fromWeb(res.body as unknown as WebReadableStream)
        .on('error', fail)
        .pipe(tar.stdin);
    });
  }

  private async load(): Promise<void> {
    // node:sqlite est intégré à Node 22 (encore « expérimental » mais stable pour de la lecture)
    const { DatabaseSync } = await import('node:sqlite');
    const cards = new Map<number, OcgCardData>();
    const texts = new Map<number, CardText>();
    const files = (await readdir(this.cdbDir)).filter(
      (f) => f === 'cards.cdb' || /^(prerelease|release)-.+\.cdb$/.test(f),
    );
    // cards.cdb en dernier : les cartes officielles priment sur les avant-premières
    files.sort((a, b) => (a === 'cards.cdb' ? 1 : b === 'cards.cdb' ? -1 : a.localeCompare(b)));
    for (const file of files) {
      const db = new DatabaseSync(join(this.cdbDir, file), { readOnly: true });
      try {
        const datas = db.prepare(
          'SELECT id, alias, setcode, type, atk, def, level, race, attribute FROM datas',
        );
        datas.setReadBigInts(true);
        for (const row of datas.all() as unknown as CdbDataRow[])
          cards.set(Number(row.id), toCardData(row));
        const txt = db.prepare('SELECT * FROM texts');
        txt.setReadBigInts(true);
        for (const row of txt.all() as unknown as CdbTextRow[]) {
          texts.set(Number(row.id), { name: row.name, strings: cardStrings(row) });
        }
      } finally {
        db.close();
      }
    }
    const stringsPath = join(this.root, 'strings.conf');
    const strings = existsSync(stringsPath)
      ? parseStringsConf(await readFile(stringsPath, 'utf8'))
      : { system: new Map<number, string>(), victory: new Map<number, string>() };

    const scriptCount =
      (await readdir(join(this.scriptsDir, 'official')).catch(() => [])).length +
      (await readdir(join(this.scriptsDir, 'pre-release')).catch(() => [])).length;

    this.cards = cards;
    this.texts = texts;
    this.system = strings.system;
    this.victory = strings.victory;
    this.scriptCache = new Map();
    this.scriptCount = scriptCount;
    this.updatedAt = (await stat(this.cdbDir).catch(() => null))?.mtime ?? new Date();
    this.logger.log(`Simulateur : ${cards.size} cartes, ${scriptCount} scripts`);
  }

  // MARK: - Accès pour le moteur

  card(code: number): OcgCardData | null {
    return this.cards.get(code) ?? null;
  }

  text(code: number): CardText | null {
    return this.texts.get(code) ?? null;
  }

  /** Script demandé par le moteur : `c<passcode>.lua` (officiel ou avant-première) ou utilitaire. */
  script(name: string): string | null {
    if (this.scriptCache.has(name)) return this.scriptCache.get(name)!;
    const safe = name.replace(/^\.\/|^\//, '');
    if (safe.includes('..')) return null;
    const candidates = /^c\d+\.lua$/.test(safe)
      ? [join('official', safe), join('pre-release', safe)]
      : [safe];
    let content: string | null = null;
    for (const rel of candidates) {
      try {
        content = readFileSync(join(this.scriptsDir, rel), 'utf8');
        break;
      } catch {
        // essai suivant
      }
    }
    this.scriptCache.set(name, content);
    return content;
  }

  /** Texte d'une description d'effet (`code << 20 | index`) ou d'un texte système. */
  describe(description: bigint | number): string | null {
    const desc = BigInt(description);
    if (desc === 0n) return null;
    const code = Number(desc >> 20n);
    if (code === 0) return this.system.get(Number(desc)) ?? null;
    const text = this.texts.get(code);
    const str = text?.strings[Number(desc & 0xfffffn)];
    return str || (text ? text.name : null);
  }

  systemString(id: number): string | null {
    return this.system.get(id) ?? null;
  }

  victoryReason(id: number): string | null {
    return this.victory.get(id) ?? null;
  }
}
