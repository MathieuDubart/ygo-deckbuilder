import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  role: 'USER' | 'ADMIN';
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Injecte l'utilisateur authentifié (undefined sur une route @Public sans token). */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
