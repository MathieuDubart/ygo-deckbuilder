import { Body, Controller, Get, HttpCode, Param, Post, Patch, Query } from '@nestjs/common';
import {
  ADMIN_RUNNABLE_SYNCS,
  adminUsersQuerySchema,
  setUserRoleSchema,
  type AdminRunnableSync,
  type AdminUsersQueryInput,
  type SetUserRoleInput,
} from '@ygo/shared';
import { BadRequestException } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { t } from '../../common/i18n/locale-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';

/** Panneau d'administration. Tout est derrière `@Roles('ADMIN')`, sans exception. */
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  users(@Query(new ZodValidationPipe(adminUsersQuerySchema)) q: AdminUsersQueryInput) {
    return this.admin.users(q);
  }

  @Patch('users/:id/role')
  setRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setUserRoleSchema)) body: SetUserRoleInput,
  ) {
    return this.admin.setRole(user.id, id, body.role);
  }

  /** Relance une synchro. Longue : la réponse arrive à la fin. */
  @Post('syncs/:id/run')
  @HttpCode(204)
  run(@Param('id') id: string) {
    if (!(ADMIN_RUNNABLE_SYNCS as readonly string[]).includes(id)) {
      throw new BadRequestException(t('errors.unknownSync', { id }));
    }
    return this.admin.runSync(id as AdminRunnableSync);
  }
}
