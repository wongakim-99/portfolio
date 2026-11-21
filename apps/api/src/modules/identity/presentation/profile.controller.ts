import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Put, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminTokenGuard } from '../../../shared/http/admin-token.guard.js';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { ProfileService } from '../application/profile.service.js';
import { AVATAR_FILE, AVATAR_TYPES } from '../domain/avatar.js';
import { CurrentUser } from './current-user.js';
import { RoleDto } from './identity.dto.js';

// 프로필 사진과 역할 지정. 이름과 소개를 바꾸는 PATCH /me/profile 은 응답에 글 수가 들어가서 feed 영역이 받음
@Controller('community')
export class ProfileController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly currentUser: CurrentUser,
  ) {}

  // 본문은 사진 파일 그대로 받음 (setup.ts 의 raw 본문 파서, 1MB 제한)
  @Put('me/avatar')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async uploadAvatar(@Req() req: Request) {
    assertSameOrigin(req);
    return this.profiles.setAvatar(await this.currentUser.require(req), req.body);
  }

  @Delete('me/avatar')
  @HttpCode(204)
  async removeAvatar(@Req() req: Request) {
    assertSameOrigin(req);
    await this.profiles.removeAvatar(await this.currentUser.require(req));
  }

  @Get('avatars/:file')
  @SkipThrottle()
  async avatar(@Req() req: Request, @Res() res: Response) {
    const file = req.params.file as string;
    if (!AVATAR_FILE.test(file)) throw new NotFoundException('사진을 찾을 수 없습니다.');
    const body = await this.profiles.readAvatar(file);
    res.set({
      'Content-Type': AVATAR_TYPES[file.split('.').pop() as keyof typeof AVATAR_TYPES],
      // 사진을 바꾸면 파일 이름이 바뀌므로 같은 주소의 내용은 다시 바뀌지 않음
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    body.on('error', () => res.destroy());
    body.pipe(res);
  }

  // 역할 지정은 서버의 ADMIN_TOKEN 으로만 (README '관리자 역할과 관리실')
  @Put('admin/users/role')
  @UseGuards(AdminTokenGuard)
  async setRole(@Body() dto: RoleDto, @Req() req: Request) {
    jsonOnly(req);
    return { user: await this.profiles.setRole(dto.email, dto.role) };
  }
}
