import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AUTH_MODE_HEADER,
  loginSchema,
  refreshTokenBodySchema,
  registerSchema,
  type LoginInput,
  type PublicUser,
  type RefreshTokenBody,
  type RegisterInput,
  type TokenSessionDto,
} from '@ygo/shared';
import type { CookieOptions, Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.service';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import type { IssuedTokens } from './token.service';

@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } }) // anti brute-force
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser | TokenSessionDto> {
    return this.respond(req, res, await this.auth.register(body, req.headers['user-agent']));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser | TokenSessionDto> {
    return this.respond(req, res, await this.auth.login(body, req.headers['user-agent']));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenBodySchema)) body: RefreshTokenBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser | TokenSessionDto> {
    const token = this.readRefreshToken(req, body);
    if (!token) throw new UnauthorizedException();
    return this.respond(req, res, await this.auth.refresh(token, req.headers['user-agent']));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(refreshTokenBodySchema)) body: RefreshTokenBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefreshToken(req, body));
    const base = this.cookieBase();
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.auth.me(user.id);
  }

  /** Cookie (navigateur) ou corps de la requête (client natif). */
  private readRefreshToken(req: Request, body: RefreshTokenBody): string | undefined {
    return (
      (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE] ?? body.refreshToken
    );
  }

  /** Navigateur : cookies httpOnly · client natif (`X-Auth-Mode: token`) : tokens dans le corps. */
  private respond(
    req: Request,
    res: Response,
    { user, tokens }: { user: PublicUser; tokens: IssuedTokens },
  ): PublicUser | TokenSessionDto {
    if (req.headers[AUTH_MODE_HEADER] === 'token') {
      return {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExpiresIn: Math.floor(tokens.accessMaxAgeMs / 1000),
        refreshExpiresIn: Math.floor(tokens.refreshMaxAgeMs / 1000),
      };
    }
    this.setCookies(res, tokens);
    return user;
  }

  private cookieBase(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.config.get('COOKIE_SECURE'), path: '/' };
  }

  private setCookies(res: Response, t: IssuedTokens): void {
    const base = this.cookieBase();
    res.cookie(ACCESS_COOKIE, t.accessToken, { ...base, maxAge: t.accessMaxAgeMs });
    res.cookie(REFRESH_COOKIE, t.refreshToken, { ...base, maxAge: t.refreshMaxAgeMs });
  }
}
