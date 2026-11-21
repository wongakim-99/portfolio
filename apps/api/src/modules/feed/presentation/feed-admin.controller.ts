import { Controller, Delete, Get, Header, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { RequirePermission } from '../../identity/index.js';
import { ModerationService } from '../application/moderation.service.js';
import { PostsService } from '../application/posts.service.js';

// 관리실의 신고 처리와 관리 삭제. 관리자 세션이나 서버의 ADMIN_TOKEN 으로 씀
@Controller('community/admin')
export class FeedAdminController {
  constructor(
    private readonly posts: PostsService,
    private readonly moderation: ModerationService,
  ) {}

  @Get('reports')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('reports:read')
  async reports() {
    return { reports: await this.moderation.reportsForAdmin() };
  }

  @Delete('reports/:id')
  @HttpCode(204)
  @RequirePermission('reports:dismiss')
  async dismissReport(@Req() req: Request) {
    assertSameOrigin(req);
    await this.moderation.dismissReport(req.params.id as string);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  @RequirePermission('content:moderate')
  async removePost(@Req() req: Request) {
    assertSameOrigin(req);
    await this.posts.remove(req.params.id as string);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  @RequirePermission('content:moderate')
  async removeComment(@Req() req: Request) {
    assertSameOrigin(req);
    await this.posts.removeComment(req.params.id as string);
  }
}
