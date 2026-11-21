import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { AuthService } from '../application/auth.service.js';
import { ProfileService } from '../application/profile.service.js';
import { CurrentUser } from './current-user.js';
import { ChangePasswordDto, EmailDto, LoginDto, RegisterDto, ResetPasswordDto, TokenDto } from './identity.dto.js';
import { clearSessionCookie, readSessionToken, writeSessionCookie } from './session-cookie.js';

// 가입, 로그인, 메일 링크, 비밀번호. 주소는 피드를 처음 만들 때의 /api/community/auth/* 그대로
@Controller('community/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly profiles: ProfileService,
    private readonly currentUser: CurrentUser,
  ) {}

  @Get('me')
  @SkipThrottle()
  async me(@Req() req: Request) {
    return { user: await this.currentUser.find(req) };
  }

  @Get('config')
  @SkipThrottle()
  config() {
    return { registrationEnabled: this.auth.registrationEnabled, uploadsEnabled: this.profiles.uploadsEnabled };
  }

  @Post('register')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.register(dto);
    return { ok: true };
  }

  @Post('resend')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async resend(@Body() dto: LoginDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.resendVerification(dto);
    return { ok: true };
  }

  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async verify(@Body() dto: TokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSameOrigin(req);
    jsonOnly(req);
    const { identity, sessionToken } = await this.auth.verify(dto.token);
    writeSessionCookie(res, sessionToken);
    return { user: identity };
  }

  @Post('reset-request')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async resetRequest(@Body() dto: EmailDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.requestReset(dto.email);
    return { ok: true };
  }

  @Post('reset')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSameOrigin(req);
    jsonOnly(req);
    const { identity, sessionToken } = await this.auth.login(dto);
    writeSessionCookie(res, sessionToken);
    return { user: identity };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSameOrigin(req);
    await this.auth.logout(readSessionToken(req));
    clearSessionCookie(res);
  }

  @Post('password')
  @HttpCode(204)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.auth.changePassword(await this.currentUser.require(req), readSessionToken(req), dto);
  }
}
