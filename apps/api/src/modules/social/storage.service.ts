import { randomBytes } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { BadRequestException, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type ProfileImageKind } from '@ygo/shared';
import sharp from 'sharp';
import { AppConfig } from '../../config/app-config.service';
import { t } from '../../common/i18n/locale-context';
import { IMAGE_SPECS, isProfileImagePath, profileImagePath } from './image-path';

/**
 * Images de profil sur disque. Un dossier (`UPLOADS_DIR`) qu'on monte en volume et qu'on
 * sauvegarde avec la base : pas de dépendance à un service objet, l'app reste auto-hébergeable
 * sur un simple serveur.
 *
 * Tout ce qui entre est **réencodé en WebP** par sharp. C'est ce qui garantit que le fichier
 * servi est bien une image : un SVG piégé ou un script déguisé en .png ne survit pas au
 * décodage, et le type MIME servi n'est jamais celui annoncé par le client.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(config: AppConfig) {
    this.root = resolve(config.get('UPLOADS_DIR'));
  }

  async onModuleInit(): Promise<void> {
    await mkdir(join(this.root, 'profile'), { recursive: true });
    this.logger.log(`Images de profil dans ${this.root}`);
  }

  /** Réencode et écrit l'image, puis renvoie son chemin relatif (à stocker en base). */
  async saveProfileImage(kind: ProfileImageKind, userId: string, input: Buffer): Promise<string> {
    const spec = IMAGE_SPECS[kind];
    let encoded: Buffer;
    try {
      encoded = await sharp(input, { animated: false })
        // `withoutEnlargement` : une petite image reste petite plutôt que d'être floutée
        .resize({ ...spec, fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 82 })
        // Les métadonnées ne sont pas recopiées par défaut : l'EXIF d'une photo (dont sa
        // position GPS) ne doit pas partir avec un avatar public.
        .toBuffer();
    } catch {
      throw new BadRequestException(t('errors.imageUnreadable'));
    }

    const path = profileImagePath(kind, userId, randomBytes(8).toString('hex'));
    const absolute = this.absolute(path);
    await mkdir(dirname(absolute), { recursive: true });
    await sharp(encoded).toFile(absolute);
    return path;
  }

  /** Suppression silencieuse : un fichier déjà absent n'est pas une erreur à remonter. */
  async remove(path: string | null): Promise<void> {
    if (!path || !isProfileImagePath(path)) return;
    await rm(this.absolute(path), { force: true }).catch((error: unknown) => {
      this.logger.warn(`Suppression de ${path} impossible : ${String(error)}`);
    });
  }

  /**
   * Ouvre une image pour la servir. Renvoie null si le chemin n'a pas la forme attendue ou si
   * le fichier a disparu — l'appelant répond 404 sans distinguer les deux cas.
   */
  async open(path: string): Promise<{ stream: ReadStream; size: number } | null> {
    if (!isProfileImagePath(path)) return null;
    const absolute = this.absolute(path);
    try {
      const info = await stat(absolute);
      if (!info.isFile()) return null;
      return { stream: createReadStream(absolute), size: info.size };
    } catch {
      return null;
    }
  }

  /**
   * Deuxième verrou après `isProfileImagePath` : même si le format changeait un jour, rien ne
   * peut sortir de `UPLOADS_DIR`.
   */
  private absolute(path: string): string {
    const absolute = resolve(this.root, path);
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new BadRequestException(t('errors.imageUnreadable'));
    }
    return absolute;
  }
}
