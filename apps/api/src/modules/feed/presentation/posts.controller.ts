import { Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Readable } from 'node:stream';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { CurrentUser } from '../../identity/index.js';
import { FeedMediaService } from '../application/feed-media.service.js';
import { ModerationService } from '../application/moderation.service.js';
import { PostsService } from '../application/posts.service.js';
import { FEED_IMAGE_FILE, FEED_IMAGE_TYPES, videoThumbnailUrl } from '../domain/feed-media.js';
import { ReportDto, WriteCommentDto, WritePostDto } from './feed.dto.js';

// 사진 응답 공통 머리. 다른 사이트가 끌어다 쓰지 못하게 같은 출처에서만 읽힘
function sendImage(res: Response, body: Readable, type: string, cache: string) {
  res.set({ 'Content-Type': type, 'Cache-Control': cache, 'Content-Security-Policy': "default-src 'none'", 'Cross-Origin-Resource-Policy': 'same-origin' });
  body.on('error', () => res.destroy());
  body.pipe(res);
}

// 피드 글, 답글, 좋아요, 사진, 유튜브 미리보기, 신고. 읽기는 누구나, 쓰기는 이메일 확인을 마친 회원만
// 읽기 응답에는 보는 사람이 좋아요를 눌렀는지가 들어가서 브라우저와 앞단 어디에도 캐시하지 않음
@Controller('community')
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly media: FeedMediaService,
    private readonly moderation: ModerationService,
    private readonly currentUser: CurrentUser,
  ) {}

  @Get('posts')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: Request, @Query('before') before?: string, @Query('author') author?: string) {
    return this.posts.list(await this.currentUser.find(req), before, author);
  }

  @Get('posts/:id')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async get(@Req() req: Request) {
    return this.posts.get(req.params.id as string, await this.currentUser.find(req));
  }

  @Post('posts')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
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
  @Header('Cache-Control', 'private, no-store')
  async listComments(@Req() req: Request, @Query('after') after?: string) {
    return this.posts.listComments(req.params.id as string, await this.currentUser.find(req), after);
  }

  @Post('posts/:id/comments')
  @Throttle({ default: { limit: 40, ttl: 60 * 60_000 } })
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

  // 좋아요: PUT 은 누르기, DELETE 는 거두기. 같은 요청을 다시 보내도 숫자가 두 번 바뀌지 않음
  @Put('posts/:id/like')
  @Throttle({ default: { limit: 300, ttl: 60 * 60_000 } })
  async likePost(@Req() req: Request) {
    assertSameOrigin(req);
    return this.posts.like('post', req.params.id as string, true, await this.currentUser.require(req, '로그인한 뒤 누를 수 있습니다.'));
  }

  @Delete('posts/:id/like')
  @Throttle({ default: { limit: 300, ttl: 60 * 60_000 } })
  async unlikePost(@Req() req: Request) {
    assertSameOrigin(req);
    return this.posts.like('post', req.params.id as string, false, await this.currentUser.require(req));
  }

  @Put('comments/:id/like')
  @Throttle({ default: { limit: 300, ttl: 60 * 60_000 } })
  async likeComment(@Req() req: Request) {
    assertSameOrigin(req);
    return this.posts.like('comment', req.params.id as string, true, await this.currentUser.require(req, '로그인한 뒤 누를 수 있습니다.'));
  }

  @Delete('comments/:id/like')
  @Throttle({ default: { limit: 300, ttl: 60 * 60_000 } })
  async unlikeComment(@Req() req: Request) {
    assertSameOrigin(req);
    return this.posts.like('comment', req.params.id as string, false, await this.currentUser.require(req));
  }

  // 글에 붙일 사진. 본문은 사진 파일 그대로 받음 (setup.ts 의 raw 본문 파서). 브라우저가 줄이고 위치 정보를 뺀 뒤 올림
  @Post('images')
  @Throttle({ default: { limit: 40, ttl: 60 * 60_000 } })
  async uploadImage(@Req() req: Request) {
    assertSameOrigin(req);
    const owner = await this.currentUser.require(req, '로그인한 뒤 사진을 올릴 수 있습니다.');
    return { image: await this.media.uploadImage(req.body, owner.id) };
  }

  // 사진은 파일 이름이 바뀌지 않으므로 1년 캐시함
  @Get('images/:file')
  @SkipThrottle()
  async image(@Req() req: Request, @Res() res: Response) {
    const file = req.params.file as string;
    if (!FEED_IMAGE_FILE.test(file)) throw new NotFoundException('사진을 찾을 수 없습니다.');
    const body = await this.media.readImage(file);
    sendImage(res, body, FEED_IMAGE_TYPES[file.split('.').pop() as keyof typeof FEED_IMAGE_TYPES], 'public, max-age=31536000, immutable');
  }

  // 글을 쓰는 동안 보여 줄 유튜브 미리보기. 바깥에 요청이 나가므로 로그인한 회원만, 시간당 횟수를 묶음
  @Get('videos/:id')
  @Throttle({ default: { limit: 60, ttl: 60 * 60_000 } })
  @Header('Cache-Control', 'private, max-age=3600')
  async video(@Req() req: Request) {
    await this.currentUser.require(req, '로그인한 뒤 미리 볼 수 있습니다.');
    const id = req.params.id as string;
    const meta = await this.media.video(id);
    if (!meta) throw new NotFoundException('영상을 찾을 수 없습니다.');
    return { video: { id, ...meta, thumbnail: videoThumbnailUrl(id) } };
  }

  @Get('videos/:id/thumbnail')
  @SkipThrottle()
  async thumbnail(@Req() req: Request, @Res() res: Response) {
    sendImage(res, await this.media.thumbnail(req.params.id as string), 'image/jpeg', 'public, max-age=604800');
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
