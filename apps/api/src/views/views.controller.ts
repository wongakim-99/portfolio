import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ipHash } from '../common/visitor-hash.js';
import type { Env } from '../env.js';
import { ViewsService } from './views.service.js';

const PAGE = 'home';

@Controller('views')
export class ViewsController {
  constructor(
    private readonly views: ViewsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  async total() {
    return { total: await this.views.total(PAGE) };
  }

  @Post()
  @HttpCode(200)
  async hit(@Req() req: Request) {
    // 같은 IP 는 브라우저가 달라도, 며칠 뒤 다시 와도 한 번만 셈
    const ip = ipHash(req, this.config.get('HASH_SALT', { infer: true }));
    return { total: await this.views.hit(PAGE, ip) };
  }
}
