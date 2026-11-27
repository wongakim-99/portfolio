import {
  Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Patch, Post, Put, Query, Req, Res, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Env } from '../../../config/env.js';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { ipHash } from '../../../shared/http/visitor-hash.js';
import { CurrentUser, RequirePermission } from '../../identity/index.js';
import { BlogAccessService } from '../application/blog-access.service.js';
import { BlogCalendarService } from '../application/blog-calendar.service.js';
import { BlogDraftsService } from '../application/blog-drafts.service.js';
import { BlogImagesService } from '../application/blog-images.service.js';
import { BlogPostsService } from '../application/blog-posts.service.js';
import { ProofGradingService } from '../application/proof-grading.service.js';
import { BLOG_IMAGE_FILE, BLOG_IMAGE_TYPES } from '../domain/blog-image.js';
import { AccessRequestDto, BlogDraftDto, ProofDto, WriteBlogPostDto, WritingMinutesDto } from './blog.dto.js';

// ?tag=a&tag=b 처럼 같은 이름을 여러 번 보내면 배열로 오므로 글자 하나일 때만 씀
const single = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

// 블로그. 로그인은 피드 계정을 그대로 씀. 글쓰기는 주인(owner 역할)만, 읽기는 글마다 고른 공개 범위대로
// 누가 보느냐에 따라 응답이 달라지므로 읽기 응답은 브라우저와 앞단 어디에도 캐시하지 않음
@Controller('blog')
export class BlogController {
  constructor(
    private readonly posts: BlogPostsService,
    private readonly access: BlogAccessService,
    private readonly drafts: BlogDraftsService,
    private readonly calendar: BlogCalendarService,
    private readonly images: BlogImagesService,
    private readonly proofs: ProofGradingService,
    private readonly currentUser: CurrentUser,
    private readonly config: ConfigService<Env, true>,
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
    @Query('room') room?: unknown,
  ) {
    return this.posts.list(await this.currentUser.find(req), {
      before: single(before), tag: single(tag), q: single(q), visibility: single(visibility), room: single(room),
    });
  }

  @Get('summary')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async summary(@Req() req: Request) {
    return this.posts.summary(await this.currentUser.find(req));
  }

  // 책상 달력 한 달. ?month=2026-11. 보는 사람에 따라 나만 보기 글 도장이 달라져 캐시하지 않음
  @Get('calendar')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  async calendarMonth(@Req() req: Request, @Query('month') month?: unknown) {
    return this.calendar.month(await this.currentUser.find(req), single(month) ?? '');
  }

  // 글쓰기 화면이 임시저장하며 보내는 '글을 고친 분'. 책상 달력의 쓴 시간이 됨
  @Put('writing-minutes')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @RequirePermission('blog:write')
  async logWriting(@Body() dto: WritingMinutesDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.calendar.log(await this.currentUser.require(req), dto.minutes);
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

  // 쓰다 만 글. :key 는 새 글이면 new, 고치는 글이면 그 글 ID. 글쓴이 본인 것만 읽고 씀
  @Get('drafts/:key')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:write')
  async draft(@Req() req: Request) {
    return { draft: await this.drafts.get(req.params.key as string, await this.currentUser.require(req)) };
  }

  // 글쓰기 화면이 쉬는 틈마다 덮어씀. 창 두 개를 띄워도 넉넉하게 1분에 60번까지
  @Put('drafts/:key')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @RequirePermission('blog:write')
  async saveDraft(@Body() dto: BlogDraftDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    const content = { title: dto.title, body: dto.body, visibility: dto.visibility, tags: dto.tags ?? [], cover: dto.cover ?? null, roomId: dto.roomId ?? null };
    return this.drafts.save(req.params.key as string, content, await this.currentUser.require(req));
  }

  @Delete('drafts/:key')
  @HttpCode(204)
  @RequirePermission('blog:write')
  async discardDraft(@Req() req: Request) {
    assertSameOrigin(req);
    await this.drafts.discard(req.params.key as string, await this.currentUser.require(req));
  }

  // 글에 넣을 사진. 본문은 사진 파일 그대로 받음 (setup.ts 의 raw 본문 파서). 브라우저가 줄이고 위치 정보를 뺀 뒤 올림
  @Post('images')
  @RequirePermission('blog:write')
  @Throttle({ default: { limit: 120, ttl: 60 * 60_000 } })
  async uploadImage(@Req() req: Request) {
    assertSameOrigin(req);
    return { image: await this.images.upload(req.body) };
  }

  // 사진은 파일 이름이 바뀌지 않으므로 1년 캐시함. 이름이 무작위라 본문을 받은 사람만 주소를 앎
  @Get('images/:file')
  @SkipThrottle()
  async image(@Req() req: Request, @Res() res: Response) {
    const file = req.params.file as string;
    if (!BLOG_IMAGE_FILE.test(file)) throw new NotFoundException('사진을 찾을 수 없습니다.');
    const body = await this.images.read(file);
    res.set({
      'Content-Type': BLOG_IMAGE_TYPES[file.split('.').pop() as keyof typeof BLOG_IMAGE_TYPES],
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    body.on('error', () => res.destroy());
    body.pipe(res);
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

  // 잠긴 글의 '증명 제출'. AI 가 쓰는 빨간 펜 채점평을 받는 대로 글자 그대로 흘려보냄. 점수는 늘 0점이고 글은 열리지 않음
  // AI 를 못 쓰면(키 없음, 하루 한도, 늦음) 503. 화면은 미리 적어 둔 채점평을 씀
  @Post('posts/:id/proofs')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async gradeProof(@Body() dto: ProofDto, @Req() req: Request, @Res() res: Response) {
    assertSameOrigin(req);
    jsonOnly(req);
    // 방문자가 창을 닫으면 AI 호출도 멈춤
    const closed = new AbortController();
    res.on('close', () => closed.abort());
    const visitor = ipHash(req, this.config.get('HASH_SALT', { infer: true }));
    const verdict = await this.proofs.grade(req.params.id as string, dto, visitor, closed.signal);
    if (!verdict) throw new ServiceUnavailableException('채점 선생님이 자리를 비웠습니다.');
    // no-transform: 앞단 Caddy 의 압축(encode)이 조각을 모아 두지 않고 바로 넘기게 함
    res.status(200).set({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    try {
      for await (const piece of verdict) res.write(piece);
    } catch {
      // 중간에 끊기면 받은 데까지만 보여 줌
    } finally {
      res.end();
    }
  }
}
