import {
  Body, Controller, Delete, Get, HttpCode, Post, Patch, Query, Req, Res,
  UnsupportedMediaTypeException, UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminTokenGuard } from '../messages/admin-token.guard.js';
import { CommunityAuthService } from './community-auth.service.js';
import { ChangePasswordDto, EmailDto, LoginDto, RegisterDto, ReportDto, ResetPasswordDto, TokenDto, WriteCommentDto, WritePostDto } from './community.dto.js';
import { CommunityPostsService } from './community-posts.service.js';

function jsonOnly(req: Request): void {
  if (!req.is('application/json')) throw new UnsupportedMediaTypeException('JSON 요청만 받을 수 있습니다.');
}

@Controller('community')
export class CommunityController {
  constructor(
    private readonly auth: CommunityAuthService,
    private readonly posts: CommunityPostsService,
  ) {}

  @Get('auth/me')
  @SkipThrottle()
  async me(@Req() req: Request) {
    return { user: await this.auth.current(req) };
  }

  @Get('auth/config')
  @SkipThrottle()
  config() {
    return { registrationEnabled: this.auth.registrationEnabled };
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

  @Get('posts')
  @SkipThrottle()
  list(@Query('before') before?: string) {
    return this.posts.list(before);
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

  @Get('admin/reports')
  @UseGuards(AdminTokenGuard)
  async reportsForAdmin() {
    return { reports: await this.posts.reportsForAdmin() };
  }

  @Delete('admin/posts/:id')
  @HttpCode(204)
  @UseGuards(AdminTokenGuard)
  async adminRemovePost(@Req() req: Request) {
    await this.posts.remove(req.params.id as string);
  }

  @Delete('admin/comments/:id')
  @HttpCode(204)
  @UseGuards(AdminTokenGuard)
  async adminRemoveComment(@Req() req: Request) {
    await this.posts.removeComment(req.params.id as string);
  }
}
