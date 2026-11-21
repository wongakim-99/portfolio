import type { Request, Response } from 'express';
import { SECRET_TOKEN } from '../../../shared/crypto/secret-token.js';
import { SESSION_AGE_MS } from '../domain/session.js';

// 로그인은 30일짜리 HttpOnly, SameSite=Strict 쿠키. 로컬 HTTP 개발에서는 Secure 를 못 쓰므로 다른 이름을 씀
const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-community' : 'community_dev';
const secure = () => process.env.NODE_ENV === 'production';

export function readSessionToken(req: Request): string | null {
  const item = req.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const token = item?.slice(COOKIE_NAME.length + 1);
  return token && SECRET_TOKEN.test(token) ? token : null;
}

export function writeSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: secure(), sameSite: 'strict', path: '/', maxAge: SESSION_AGE_MS });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/', secure: secure(), sameSite: 'strict' });
}
