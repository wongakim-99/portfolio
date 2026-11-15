import {
  Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Post, Patch, Put, Query, Req, Res,
  UnsupportedMediaTypeException, UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminTokenGuard } from '../messages/admin-token.guard.js';
import { MessagesService } from '../messages/messages.service.js';
import { CommunityAuthService } from './community-auth.service.js';
import {
  ChangePasswordDto, EmailDto, LoginDto, ProfileDto, RegisterDto, ReportDto, ResetPasswordDto, RoleDto, TokenDto,
  WriteCommentDto, WritePostDto,
} from './community.dto.js';
import { RequirePermission } from './community-permission.guard.js';
import { CommunityPostsService } from './community-posts.service.js';
import { CommunityProfileService } from './community-profile.service.js';
import { AVATAR_FILE, CommunityStorageService } from './community-storage.service.js';
import { CommunityTopologyService } from './community-topology.service.js';

const AVATAR_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

function jsonOnly(req: Request): void {
  if (!req.is('application/json')) throw new UnsupportedMediaTypeException('JSON 요청만 받을 수 있습니다.');
}

@Controller('community')
export class CommunityController {
  constructor(
    private readonly auth: CommunityAuthService,
    private readonly posts: CommunityPostsService,
    private readonly profiles: CommunityProfileService,
    private readonly storage: CommunityStorageService,
    private readonly messages: MessagesService,
    private readonly topology: CommunityTopologyService,
  ) {}

  @Get('auth/me')
  @SkipThrottle()
  async me(@Req() req: Request) {
    return { user: await this.auth.current(req) };
  }

  @Get('auth/config')
  @SkipThrottle()
  config() {
    return { registrationEnabled: this.auth.registrationEnabled, uploadsEnabled: this.storage.ready };
  }

  @Post('auth/register')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.register(dto);
    return { ok: true };
  }

  @Post('auth/resend')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async resend(@Body() dto: LoginDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.resendVerification(dto);
    return { ok: true };
  }

  @Post('auth/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async verify(@Body() dto: TokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { user: await this.auth.verify(dto.token, res) };
  }

  @Post('auth/reset-request')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async resetRequest(@Body() dto: EmailDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.requestReset(dto.email);
    return { ok: true };
  }

  @Post('auth/reset')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post('auth/login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { user: await this.auth.login(dto, res) };
  }

  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.auth.assertSameOrigin(req);
    await this.auth.logout(req, res);
  }

  @Post('auth/password')
  @HttpCode(204)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.changePassword(req, dto);
  }

  @Get('users/:id')
  @SkipThrottle()
  profile(@Req() req: Request) {
    return this.profiles.profile(req.params.id as string);
  }

  @Patch('me/profile')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async updateProfile(@Body() dto: ProfileDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { user: await this.profiles.update(await this.auth.require(req), dto) };
  }

  // 본문은 사진 파일 그대로 받음 (setup.ts 의 raw 본문 파서, 1MB 제한)
  @Put('me/avatar')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async uploadAvatar(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    return this.profiles.setAvatar(await this.auth.require(req), req.body);
  }

  @Delete('me/avatar')
  @HttpCode(204)
  async removeAvatar(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.profiles.removeAvatar(await this.auth.require(req));
  }

  @Get('avatars/:file')
  @SkipThrottle()
  async avatar(@Req() req: Request, @Res() res: Response) {
    const file = req.params.file as string;
    if (!AVATAR_FILE.test(file)) throw new NotFoundException('사진을 찾을 수 없습니다.');
    const body = await this.storage.get(`avatars/${file}`);
    res.set({
      'Content-Type': AVATAR_TYPES[file.split('.').pop() as keyof typeof AVATAR_TYPES],
      // 사진을 바꾸면 파일 이름이 바뀌므로 같은 주소의 내용은 다시 바뀌지 않음
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    body.on('error', () => res.destroy());
    body.pipe(res);
  }

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
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { post: await this.posts.create(dto, await this.auth.require(req)) };
  }

  @Patch('posts/:id')
  async edit(@Body() dto: WritePostDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { post: await this.posts.edit(req.params.id as string, dto, await this.auth.require(req)) };
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.posts.remove(req.params.id as string, (await this.auth.require(req)).id);
  }

  @Get('posts/:id/comments')
  @SkipThrottle()
  listComments(@Req() req: Request, @Query('after') after?: string) {
    return this.posts.listComments(req.params.id as string, after);
  }

  @Post('posts/:id/comments')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async addComment(@Body() dto: WriteCommentDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { comment: await this.posts.addComment(req.params.id as string, dto, await this.auth.require(req)) };
  }

  @Patch('comments/:id')
  async editComment(@Body() dto: WriteCommentDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    return { comment: await this.posts.editComment(req.params.id as string, dto, await this.auth.require(req)) };
  }

  @Delete('comments/:id')
  @HttpCode(204)
  async removeComment(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.posts.removeComment(req.params.id as string, (await this.auth.require(req)).id);
  }

  @Post('reports')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  async report(@Body() dto: ReportDto, @Req() req: Request) {
    this.auth.assertSameOrigin(req);
    jsonOnly(req);
    await this.posts.report(dto, await this.auth.require(req));
  }

  // 아래 관리 API 는 관리자 역할로 로그인한 세션이나 서버의 ADMIN_TOKEN 으로 씀 (community-permission.guard.ts)
  @Put('admin/users/role')
  @UseGuards(AdminTokenGuard)
  async setRole(@Body() dto: RoleDto, @Req() req: Request) {
    jsonOnly(req);
    return { user: await this.profiles.setRole(dto) };
  }

  @Get('admin/summary')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('messages:read')
  async adminSummary() {
    const [unreadMessages, reports] = await Promise.all([this.messages.unreadCount(), this.posts.reportCount()]);
    return { unreadMessages, reports };
  }

  @Get('admin/topology')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('server:read')
  serverTopology(@Req() req: Request, @Query('since') since?: string) {
    return this.topology.snapshot(req, since);
  }

  @Get('admin/messages')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('messages:read')
  async inbox(@Query('before') before?: string) {
    return { ...(await this.messages.inbox(before)), unread: await this.messages.unreadCount() };
  }

  @Post('admin/messages/read')
  @HttpCode(204)
  @RequirePermission('messages:read')
  async markMessagesRead(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.messages.markAllRead();
  }

  @Delete('admin/messages/:id')
  @HttpCode(204)
  @RequirePermission('messages:delete')
  async removeMessage(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.messages.remove(req.params.id as string);
  }

  @Get('admin/reports')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('reports:read')
  async reportsForAdmin() {
    return { reports: await this.posts.reportsForAdmin() };
  }

  @Delete('admin/reports/:id')
  @HttpCode(204)
  @RequirePermission('reports:dismiss')
  async dismissReport(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.posts.dismissReport(req.params.id as string);
  }

  @Delete('admin/posts/:id')
  @HttpCode(204)
  @RequirePermission('content:moderate')
  async adminRemovePost(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.posts.remove(req.params.id as string);
  }

  @Delete('admin/comments/:id')
  @HttpCode(204)
  @RequirePermission('content:moderate')
  async adminRemoveComment(@Req() req: Request) {
    this.auth.assertSameOrigin(req);
    await this.posts.removeComment(req.params.id as string);
  }
}
