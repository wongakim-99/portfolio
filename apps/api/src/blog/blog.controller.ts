import { Body, Controller, Delete, Get, Header, HttpCode, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { jsonOnly } from '../common/json-only.js';
import { CommunityAuthService } from '../community/community-auth.service.js';
import { RequirePermission } from '../community/community-permission.guard.js';
import { AccessRequestDto, ApproveDto, WriteBlogPostDto } from './blog.dto.js';
import { BlogService } from './blog.service.js';

// 블로그. 로그인은 피드 계정을 그대로 씀. 글쓰기는 주인(owner 역할)만, 읽기는 글마다 고른 공개 범위대로
// 누가 보느냐에 따라 응답이 달라지므로 읽기 응답은 브라우저와 앞단 어디에도 캐시하지 않음
@Controller('blog')
export class BlogController {
  constructor(
    private readonly auth: CommunityAuthService,
    private readonly blog: BlogService,
  ) {}

  @Get('posts')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: Request, @Query('before') before?: string) {
    return this.blog.list(await this.auth.current(req), before);
  }

  @Get('posts/:id')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async get(@Req() req: Request) {
    return this.blog.get(req.params.id as string, await this.auth.current(req));
  }

  @Post('posts')
  @RequirePermission('blog:write')
  async create(@Body() dto: WriteBlogPostDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { post: await this.blog.create(dto, await this.auth.require(req)) };
  }

  @Patch('posts/:id')
  @RequirePermission('blog:write')
  async edit(@Body() dto: WriteBlogPostDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { post: await this.blog.edit(req.params.id as string, dto, await this.auth.require(req)) };
  }

  @Delete('posts/:id')
  @HttpCode(204)
  @RequirePermission('blog:write')
  async remove(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.blog.remove(req.params.id as string);
  }

  // 잠긴 글의 '주인장에게 요청하기'. 허락은 계정에 붙으므로 로그인한 회원만 보냄
  @Post('posts/:id/access-requests')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async requestAccess(@Body() dto: AccessRequestDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    const viewer = await this.auth.current(req);
    if (!viewer) throw new UnauthorizedException('로그인한 뒤 요청할 수 있습니다.');
    return { request: await this.blog.requestAccess(req.params.id as string, viewer, dto) };
  }

  @Get('admin/requests')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:grant')
  async requests() {
    return { requests: await this.blog.pendingRequests() };
  }

  @Post('admin/requests/:id/approve')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async approve(@Body() dto: ApproveDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    await this.blog.approve(req.params.id as string, dto.scope);
  }

  @Post('admin/requests/:id/reject')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async reject(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.blog.reject(req.params.id as string);
  }

  @Get('admin/grants')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:grant')
  async grants() {
    return { grants: await this.blog.grantList() };
  }

  @Delete('admin/grants/:id')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async revoke(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.blog.revoke(req.params.id as string);
  }
}
