import { createHash, randomBytes } from 'node:crypto';

// 로그인 세션과 메일 링크에 쓰는 비밀 토큰. DB 에는 해시만 남김
export const SECRET_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const newSecretToken = (): string => randomBytes(32).toString('base64url');
export const hashSecretToken = (token: string): string => createHash('sha256').update(token).digest('hex');
