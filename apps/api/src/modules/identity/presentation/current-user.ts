import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../application/auth.service.js';
import type { Identity } from '../domain/user.js';
import { readSessionToken } from './session-cookie.js';

// 요청의 로그인 쿠키로 지금 사람을 찾음. 피드, 블로그 컨트롤러가 이것으로 로그인을 확인함
@Injectable()
export class CurrentUser {
  constructor(private readonly auth: AuthService) {}

  find(req: Request): Promise<Identity | null> {
    return this.auth.identityFor(readSessionToken(req));
  }

  async require(req: Request, message = '글을 쓰려면 로그인해 주세요.'): Promise<Identity> {
    const user = await this.find(req);
    if (!user) throw new UnauthorizedException(message);
    return user;
  }
}
