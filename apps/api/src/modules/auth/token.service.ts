import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Access token : JWT court (15 min par défaut), stateless.
 * Refresh token : valeur opaque aléatoire, stockée hashée en DB, rotée à chaque usage.
 * Réutilisation d'un refresh token déjà révoqué ⇒ on révoque toute la famille (vol probable).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async issue(
    user: { id: string; role: 'USER' | 'ADMIN' },
    userAgent?: string,
  ): Promise<IssuedTokens> {
    const accessTtl = this.config.get('ACCESS_TOKEN_TTL_SECONDS');
    const refreshTtlMs = this.config.get('REFRESH_TOKEN_TTL_DAYS') * 24 * 3600 * 1000;

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { expiresIn: accessTtl },
    );
    const refreshToken = randomBytes(48).toString('base64url');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlMs),
        userAgent: userAgent?.slice(0, 255),
      },
    });

    return {
      accessToken,
      refreshToken,
      accessMaxAgeMs: accessTtl * 1000,
      refreshMaxAgeMs: refreshTtlMs,
    };
  }

  /** Retourne l'userId si le token est valide, et le révoque (rotation). */
  async consume(refreshToken: string): Promise<string | null> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!stored) return null;

    if (stored.revokedAt) {
      await this.revokeAll(stored.userId);
      return null;
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return stored.expiresAt > new Date() ? stored.userId : null;
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
