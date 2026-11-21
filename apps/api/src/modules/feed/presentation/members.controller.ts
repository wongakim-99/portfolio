import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { CurrentUser, ProfileDto } from '../../identity/index.js';
import { MembersService } from '../application/members.service.js';

// 회원 페이지(/feed/users/:id). 응답에 피드에서 쓴 글, 댓글 수가 들어가서 피드 영역이 받음
@Controller('community')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly currentUser: CurrentUser,
  ) {}

  @Get('users/:id')
  @SkipThrottle()
  profile(@Req() req: Request) {
    return this.members.profile(req.params.id as string);
  }

  @Patch('me/profile')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async updateProfile(@Body() dto: ProfileDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return { user: await this.members.updateProfile(await this.currentUser.require(req), dto) };
  }
}
