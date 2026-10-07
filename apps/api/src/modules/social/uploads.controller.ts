import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from './storage.service';

/**
 * Service des images de profil. Public : un avatar s'affiche dans une balise `<img>`, qui ne
 * porte ni cookie ni en-tête d'authentification. Le nom de fichier contient un jeton aléatoire,
 * donc une image remplacée devient inatteignable et le cache peut être permanent.
 *
 * La route est découpée en segments nommés plutôt qu'en joker : le chemin est reconstruit puis
 * revalidé par `StorageService`, et rien d'autre que la forme attendue n'ouvre un fichier.
 */
@Controller('uploads')
@Public()
@SkipThrottle()
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Get('profile/:userId/:file')
  @Header('Content-Type', 'image/webp')
  // Le contenu est toujours du WebP réencodé par nous, mais on refuse explicitement que le
  // navigateur devine autre chose.
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Disposition', 'inline')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  // helmet pose `same-origin` par défaut : sans ça, le front (autre origine) ne peut pas
  // afficher l'image.
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async profileImage(
    @Param('userId') userId: string,
    @Param('file') file: string,
  ): Promise<StreamableFile> {
    const opened = await this.storage.open(`profile/${userId}/${file}`);
    if (!opened) throw new NotFoundException();
    return new StreamableFile(opened.stream, { length: opened.size, type: 'image/webp' });
  }
}
