import { createHash } from 'node:crypto';
import type { Request } from 'express';

// IP 원문은 저장하지 않고 salt 를 섞은 해시만 남김
export function visitorHash(req: Request, salt: string): string {
  const userAgent = req.get('user-agent') ?? '';
  return createHash('sha256').update(`${salt}:${req.ip}:${userAgent}`).digest('hex');
}
