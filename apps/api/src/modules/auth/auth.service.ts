import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CardCondition, CardLanguage, LoginInput, PublicUser, RegisterInput } from '@ygo/shared';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService, type IssuedTokens } from './token.service';
import { t } from '../../common/i18n/locale-context';

type UserRow = {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  avatarPath?: string | null;
  collectionLanguage?: CardLanguage | null;
  marketLanguage?: CardLanguage | null;
  marketMinCondition?: CardCondition | null;
};

export const toPublicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  username: u.username,
  role: u.role,
  createdAt: u.createdAt.toISOString(),
  avatarUrl: u.avatarPath ? `/uploads/${u.avatarPath}` : null,
  collectionLanguage: u.collectionLanguage ?? null,
  marketLanguage: u.marketLanguage ?? null,
  marketMinCondition: u.marketMinCondition ?? null,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: AppConfig,
  ) {}

  async register(input: RegisterInput, userAgent?: string) {
    // Le pseudo est unique sans distinction de casse (index sur `lower(username)`) : le
    // vérifier à l'identique laisserait la base lever une erreur brute à l'insertion.
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { username: { equals: input.username, mode: 'insensitive' } }],
      },
      select: { email: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === input.email ? t('errors.emailTaken') : t('errors.usernameTaken'),
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash: await this.passwords.hash(input.password),
        role: input.email === this.config.get('ADMIN_EMAIL') ? 'ADMIN' : 'USER',
      },
    });
    return this.withTokens(user, userAgent);
  }

  async login(input: LoginInput, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Même message dans les deux cas : on ne révèle pas si l'email existe.
    if (!user || !(await this.passwords.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException(t('errors.badCredentials'));
    }
    return this.withTokens(user, userAgent);
  }

  async refresh(refreshToken: string, userAgent?: string) {
    const userId = await this.tokens.consume(refreshToken);
    if (!userId) throw new UnauthorizedException(t('errors.sessionExpired'));
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.withTokens(user, userAgent);
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return refreshToken ? this.tokens.revoke(refreshToken) : Promise.resolve();
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
  }

  private async withTokens(
    user: UserRow,
    userAgent?: string,
  ): Promise<{ user: PublicUser; tokens: IssuedTokens }> {
    const current = await this.ensureAdmin(user);
    return { user: toPublicUser(current), tokens: await this.tokens.issue(current, userAgent) };
  }

  /**
   * `ADMIN_EMAIL` donne le rôle à CHAQUE ouverture de session, pas seulement à l'inscription.
   *
   * Sans ça, définir la variable après coup — le cas normal sur une instance qu'on vient de
   * monter, et celui de toutes les installations existantes — laisse le seul compte du
   * serveur sans accès à son propre panneau, sans que rien ne l'explique.
   *
   * On ne rétrograde jamais ici : une promotion faite à la main dans le panneau doit
   * survivre, et retirer un rôle est une décision, pas un effet de bord d'un redémarrage
   * avec une variable différente.
   */
  private async ensureAdmin(user: UserRow): Promise<UserRow> {
    const admin = this.config.get('ADMIN_EMAIL');
    if (!admin || user.email !== admin || user.role === 'ADMIN') return user;
    await this.prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    return { ...user, role: 'ADMIN' };
  }
}
