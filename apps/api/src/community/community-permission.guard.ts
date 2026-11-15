import { applyDecorators, CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Env } from '../env.js';
import { hasAdminToken } from '../messages/admin-token.guard.js';
import { CommunityAuthService } from './community-auth.service.js';
import type { Permission } from './community-roles.js';

const REQUIRED_PERMISSION = 'community:permission';

// 서버에서 curl 로 쓰는 ADMIN_TOKEN 은 모든 권한을 가짐. 그 밖에는 로그인한 회원의 역할로 판단함
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: CommunityAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<Permission | undefined>(REQUIRED_PERMISSION, context.getHandler());
    if (!permission) return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (hasAdminToken(req, this.config.get('ADMIN_TOKEN', { infer: true }))) return true;
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('로그인해 주세요.');
    if (!user.permissions.includes(permission)) throw new ForbiddenException('이 기능을 쓸 권한이 없습니다.');
    return true;
  }
}

export const RequirePermission = (permission: Permission) =>
  applyDecorators(SetMetadata(REQUIRED_PERMISSION, permission), UseGuards(PermissionGuard));
