import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminTokenGuard } from '../messages/admin-token.guard.js';
import { RecordDeployDto } from './dto/record-deploy.dto.js';
import { DeploysService } from './deploys.service.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

@Controller('deploys')
export class DeploysController {
  constructor(private readonly deploys: DeploysService) {}

  // 홈의 배포 영수증과 숨은 터미널(git log)이 읽음. 커밋 앞 7자와 제목, 시각, 걸린 시간만 내보냄
  @Get()
  async list(@Query('limit') limit?: string) {
    const count = Math.min(Math.max(Number.parseInt(limit ?? '', 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    return { deploys: await this.deploys.latest(count) };
  }

  // deploy/deploy.sh 가 배포를 마치면 ADMIN_TOKEN 으로 남김
  @Post()
  @HttpCode(201)
  @SkipThrottle()
  @UseGuards(AdminTokenGuard)
  async record(@Body() dto: RecordDeployDto) {
    await this.deploys.record(dto);
    return { ok: true };
  }
}
