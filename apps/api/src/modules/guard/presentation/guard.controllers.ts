import { All, Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RequirePermission } from '../../identity/index.js';
import { GuardService } from '../application/guard.service.js';

// 흔한 털기 주소(워드프레스, .env, .git 같은 것)로 온 요청. Caddy 가 페이지 서버 대신 여기로 보내고 원래 주소를 X-Trap-Path 에 실음
// 기록만 하고 404 로 돌려보냄. 세는 것이 목적이라 횟수 제한은 걸지 않음
@Controller('guard')
export class GuardTrapController {
  constructor(private readonly guard: GuardService) {}

  @All('trap')
  @SkipThrottle()
  @HttpCode(404)
  async trap(@Req() req: Request) {
    const path = req.get('x-trap-path') || req.originalUrl;
    await this.guard.note({ kind: 'scanner', ip: req.ip ?? '', method: req.method, path, agent: req.get('user-agent') ?? '' });
    return { statusCode: 404, message: '없는 주소입니다.' };
  }
}

// 관리실 '이상 징후' 칸
@Controller('community/admin/guard')
export class GuardAdminController {
  constructor(private readonly guard: GuardService) {}

  @Get()
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('server:read')
  overview() {
    return this.guard.overview();
  }

  @Delete('bans/:id')
  @HttpCode(204)
  @RequirePermission('server:read')
  async lift(@Param('id') id: string) {
    if (!(await this.guard.lift(id))) throw new NotFoundException('이미 풀렸거나 없는 차단입니다.');
  }
}
