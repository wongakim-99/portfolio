import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../../config/env.js';
import { ipHash } from '../../../shared/http/visitor-hash.js';
import { VisitsService } from '../application/visits.service.js';
import { HOME_PAGE } from '../domain/visit.js';

@Controller('views')
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  async total() {
    return { total: await this.visits.total(HOME_PAGE) };
  }

  @Post()
  @HttpCode(200)
  async hit(@Req() req: Request) {
    // 같은 IP 는 브라우저가 달라도, 며칠 뒤 다시 와도 한 번만 셈
    return { total: await this.visits.hit(HOME_PAGE, ipHash(req, this.config.get('HASH_SALT', { infer: true }))) };
  }
}
