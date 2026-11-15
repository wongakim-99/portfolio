import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Env } from '../env.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

// Authorization: Bearer <ADMIN_TOKEN>. 길이가 달라도 비교 시간이 같도록 해시끼리 비교함
export function hasAdminToken(req: Request, expected: string): boolean {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(token) && timingSafeEqual(digest(token), digest(expected));
}

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!hasAdminToken(req, this.config.get('ADMIN_TOKEN', { infer: true }))) throw new UnauthorizedException();
    return true;
  }
}
