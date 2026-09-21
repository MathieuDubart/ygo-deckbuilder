import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { LoginInput, PublicUser, RegisterInput } from '@ygo/shared';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService, type IssuedTokens } from './token.service';

type UserRow = {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
};

export const toPublicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  username: u.username,
  role: u.role,
  createdAt: u.createdAt.toISOString(),
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
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
      select: { email: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === input.email ? 'Email déjà utilisé' : "Nom d'utilisateur déjà pris",
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
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    return this.withTokens(user, userAgent);
  }

  async refresh(refreshToken: string, userAgent?: string) {
    const userId = await this.tokens.consume(refreshToken);
    if (!userId) throw new UnauthorizedException('Session expirée');
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
    return { user: toPublicUser(user), tokens: await this.tokens.issue(user, userAgent) };
  }
}
