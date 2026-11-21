import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Query, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { CurrentUser } from '../../identity/index.js';
import { ModerationService } from '../application/moderation.service.js';
import { PostsService } from '../application/posts.service.js';
import { ReportDto, WriteCommentDto, WritePostDto } from './feed.dto.js';

// 피드 글, 댓글, 신고. 읽기는 누구나, 쓰기는 이메일 확인을 마친 회원만
@Controller('community')
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly moderation: ModerationService,
    private readonly currentUser: CurrentUser,
  ) {}

  @Get('posts')
  @SkipThrottle()
  list(@Query('before') before?: string, @Query('author') author?: string) {
    return this.posts.list(before, author);
  }

  @Get('posts/:id')
  @SkipThrottle()
  get(@Req() req: Request) {
    return this.posts.get(req.params.id as string);
  }

  @Post('posts')
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  async create(@Body() dto: WritePostDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return { post: await this.posts.create(dto, await this.currentUser.require(req)) };
  }

  @Patch('posts/:id')
  async edit(@Body() dto: WritePostDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return { post: await this.posts.edit(req.params.id as string, dto, await this.currentUser.require(req)) };
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(@Req() req: Request) {
    assertSameOrigin(req);
    await this.posts.remove(req.params.id as string, (await this.currentUser.require(req)).id);
  }

  @Get('posts/:id/comments')
  @SkipThrottle()
  listComments(@Req() req: Request, @Query('after') after?: string) {
    return this.posts.listComments(req.params.id as string, after);
  }

  @Post('posts/:id/comments')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async addComment(@Body() dto: WriteCommentDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return { comment: await this.posts.addComment(req.params.id as string, dto, await this.currentUser.require(req)) };
  }

  @Patch('comments/:id')
  async editComment(@Body() dto: WriteCommentDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return { comment: await this.posts.editComment(req.params.id as string, dto, await this.currentUser.require(req)) };
  }

  @Delete('comments/:id')
  @HttpCode(204)
  async removeComment(@Req() req: Request) {
    assertSameOrigin(req);
    await this.posts.removeComment(req.params.id as string, (await this.currentUser.require(req)).id);
  }

  @Post('reports')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  async report(@Body() dto: ReportDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.moderation.report(dto, await this.currentUser.require(req));
  }
}
