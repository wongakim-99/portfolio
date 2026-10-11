import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { visitorHash } from '../common/visitor-hash.js';
import type { Env } from '../env.js';
import { AdminTokenGuard } from './admin-token.guard.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { MessagesService } from './messages.service.js';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // 같은 IP 에서 10분에 3건까지
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  async create(@Body() dto: CreateMessageDto, @Req() req: Request) {
    // honeypot 이 채워졌으면 봇이 눈치채지 않게 성공처럼 응답만 함
    if (!dto.website) {
      const visitor = visitorHash(req, this.config.get('HASH_SALT', { infer: true }));
      await this.messages.create(dto, visitor, req.get('user-agent'));
    }
    return { ok: true };
  }

  @Get()
  @SkipThrottle()
  @UseGuards(AdminTokenGuard)
  async list() {
    return { messages: await this.messages.latest(50) };
  }
}
