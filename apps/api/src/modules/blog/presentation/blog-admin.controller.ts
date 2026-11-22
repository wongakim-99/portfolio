import { Body, Controller, Delete, Get, Header, HttpCode, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { RequirePermission } from '../../identity/index.js';
import { BlogAccessService } from '../application/blog-access.service.js';
import { ProofGradingService } from '../application/proof-grading.service.js';
import { ApproveDto } from './blog.dto.js';

// 관리실의 블로그 열람 요청과 허락 명단, 오늘 증명 채점 사용량 (blog:grant)
@Controller('blog/admin')
export class BlogAdminController {
  constructor(
    private readonly access: BlogAccessService,
    private readonly proofs: ProofGradingService,
  ) {}

  @Get('proof-usage')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:grant')
  async proofUsage() {
    return this.proofs.today();
  }

  @Get('requests')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:grant')
  async requests() {
    return { requests: await this.access.pendingRequests() };
  }

  @Post('requests/:id/approve')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async approve(@Body() dto: ApproveDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.access.approve(req.params.id as string, dto.scope);
  }

  @Post('requests/:id/reject')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async reject(@Req() req: Request) {
    assertSameOrigin(req);
    await this.access.reject(req.params.id as string);
  }

  @Get('grants')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:grant')
  async grants() {
    return { grants: await this.access.grantList() };
  }

  @Delete('grants/:id')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async revoke(@Req() req: Request) {
    assertSameOrigin(req);
    await this.access.revoke(req.params.id as string);
  }
}
