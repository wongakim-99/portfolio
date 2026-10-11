import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Env } from '../env.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

// Authorization: Bearer <ADMIN_TOKEN>. 길이가 달라도 비교 시간이 같도록 해시끼리 비교함
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const header = context.switchToHttp().getRequest<Request>().get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const expected = this.config.get('ADMIN_TOKEN', { infer: true });
    if (!token || !timingSafeEqual(digest(token), digest(expected))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
