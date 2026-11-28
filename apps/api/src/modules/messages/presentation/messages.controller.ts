import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Env } from '../../../config/env.js';
import { AdminTokenGuard } from '../../../shared/http/admin-token.guard.js';
import { visitorHash } from '../../../shared/http/visitor-hash.js';
import { GuardService } from '../../guard/index.js';
import { MessagesService } from '../application/messages.service.js';
import { CreateMessageDto } from './create-message.dto.js';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly config: ConfigService<Env, true>,
    private readonly guard: GuardService,
  ) {}

  // 같은 IP 에서 10분에 3건까지
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  async create(@Body() dto: CreateMessageDto, @Req() req: Request) {
    // honeypot 이 채워졌으면 봇이 눈치채지 않게 성공처럼 응답만 하고, 봇 방어에 알려 그 IP 를 막음
    if (dto.website) {
      await this.guard.note({ kind: 'honeypot', ip: req.ip ?? '', method: req.method, path: req.path, agent: req.get('user-agent') ?? '' });
      return { ok: true };
    }
    const visitor = visitorHash(req, this.config.get('HASH_SALT', { infer: true }));
    await this.messages.create(dto, visitor, req.get('user-agent'));
    return { ok: true };
  }

  @Get()
  @SkipThrottle()
  @UseGuards(AdminTokenGuard)
  async list() {
    return { messages: await this.messages.latest(50) };
  }
}
