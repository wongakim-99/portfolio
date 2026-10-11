import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { visitorHash } from '../common/visitor-hash.js';
import type { Env } from '../env.js';
import { GiveHighFiveDto } from './dto/give-high-five.dto.js';
import { HighFivesService } from './high-fives.service.js';

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
    const visitor = visitorHash(req, this.config.get('HASH_SALT', { infer: true }));
    return this.highFives.give(visitor, dto.count);
  }
}
