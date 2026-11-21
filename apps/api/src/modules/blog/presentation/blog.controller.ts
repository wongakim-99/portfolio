import { Body, Controller, Delete, Get, Header, HttpCode, Patch, Post, Query, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { CurrentUser, RequirePermission } from '../../identity/index.js';
import { BlogAccessService } from '../application/blog-access.service.js';
import { BlogPostsService } from '../application/blog-posts.service.js';
import { AccessRequestDto, WriteBlogPostDto } from './blog.dto.js';

// ?tag=a&tag=b 처럼 같은 이름을 여러 번 보내면 배열로 오므로 글자 하나일 때만 씀
const single = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

// 블로그. 로그인은 피드 계정을 그대로 씀. 글쓰기는 주인(owner 역할)만, 읽기는 글마다 고른 공개 범위대로
// 누가 보느냐에 따라 응답이 달라지므로 읽기 응답은 브라우저와 앞단 어디에도 캐시하지 않음
@Controller('blog')
export class BlogController {
  constructor(
    private readonly posts: BlogPostsService,
    private readonly access: BlogAccessService,
    private readonly currentUser: CurrentUser,
  ) {}

  @Get('posts')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async list(
    @Req() req: Request,
    @Query('before') before?: unknown,
    @Query('tag') tag?: unknown,
    @Query('q') q?: unknown,
    @Query('visibility') visibility?: unknown,
  ) {
    return this.posts.list(await this.currentUser.find(req), {
      before: single(before), tag: single(tag), q: single(q), visibility: single(visibility),
    });
  }

  @Get('summary')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async summary(@Req() req: Request) {
    return this.posts.summary(await this.currentUser.find(req));
  }

  @Get('posts/:id')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async get(@Req() req: Request) {
    return this.posts.get(req.params.id as string, await this.currentUser.find(req));
  }

  @Post('posts')
  @RequirePermission('blog:write')
  async create(@Body() dto: WriteBlogPostDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return { post: await this.posts.create(dto, await this.currentUser.require(req)) };
  }

  @Patch('posts/:id')
  @RequirePermission('blog:write')
  async edit(@Body() dto: WriteBlogPostDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return { post: await this.posts.edit(req.params.id as string, dto, await this.currentUser.require(req)) };
  }

  @Delete('posts/:id')
  @HttpCode(204)
  @RequirePermission('blog:write')
  async remove(@Req() req: Request) {
    assertSameOrigin(req);
    await this.posts.remove(req.params.id as string);
  }

  // 잠긴 글의 '주인장에게 요청하기'. 허락은 계정에 붙으므로 로그인한 회원만 보냄
  @Post('posts/:id/access-requests')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async requestAccess(@Body() dto: AccessRequestDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    const viewer = await this.currentUser.require(req, '로그인한 뒤 요청할 수 있습니다.');
    return { request: await this.access.requestAccess(req.params.id as string, viewer, dto.message) };
  }
}
