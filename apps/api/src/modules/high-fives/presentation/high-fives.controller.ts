import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Env } from '../../../config/env.js';
import { visitorHash } from '../../../shared/http/visitor-hash.js';
import { HighFivesService } from '../application/high-fives.service.js';
import { GiveHighFiveDto } from './give-high-five.dto.js';

@Controller('high-fives')
export class HighFivesController {
  constructor(
    private readonly highFives: HighFivesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  async total() {
    return { total: await this.highFives.total() };
  }

  // 같은 IP 에서 1분에 20번까지
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async give(@Body() dto: GiveHighFiveDto, @Req() req: Request) {
    return this.highFives.give(visitorHash(req, this.config.get('HASH_SALT', { infer: true })), dto.count);
  }
}
