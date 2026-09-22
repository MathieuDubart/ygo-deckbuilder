import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_COOKIE } from '../../modules/auth/auth.constants';
import type { AuthenticatedRequest, AuthUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { t } from '../i18n/locale-context';

interface AccessPayload {
  sub: string;
  role: AuthUser['role'];
}

/**
 * Guard global : toute route est protégée par défaut, sauf @Public().
 * Le token est lu dans le cookie httpOnly (web) ou le header Authorization (clients tiers / app iOS un jour).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(req);

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AccessPayload>(token);
        req.user = { id: payload.sub, role: payload.role };
      } catch {
        if (!isPublic) throw new UnauthorizedException(t('errors.sessionExpired'));
      }
    }

    if (!isPublic && !req.user) throw new UnauthorizedException();
    return true;
  }

  private extractToken(req: AuthenticatedRequest): string | undefined {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    if (cookie) return cookie;
    const [scheme, value] = req.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' ? value : undefined;
  }
}
