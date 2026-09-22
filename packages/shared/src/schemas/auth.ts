import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, _ and - only'),
  password: z.string().min(10).max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

/**
 * Clients natifs (app iOS) : en-tête `X-Auth-Mode: token` → les tokens sont renvoyés dans le
 * corps au lieu de cookies, et le refresh token est renvoyé dans le corps de /auth/refresh et
 * /auth/logout. Le navigateur, lui, garde les cookies httpOnly.
 */
export const AUTH_MODE_HEADER = 'x-auth-mode';

export const refreshTokenBodySchema = z
  .object({ refreshToken: z.string().min(1).max(512).optional() })
  .default({});
export type RefreshTokenBody = z.infer<typeof refreshTokenBodySchema>;

export interface TokenSessionDto {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  /** Durées de vie en secondes */
  accessExpiresIn: number;
  refreshExpiresIn: number;
}
