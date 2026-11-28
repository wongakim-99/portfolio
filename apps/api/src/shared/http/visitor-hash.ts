import { createHash } from 'node:crypto';
import type { Request } from 'express';

// IP 원문은 저장하지 않고 salt 를 섞은 해시만 남김

/** 사람(IP + 브라우저) 단위. 하이파이브 하루 한도, 쪽지 기록, 관리실 방문자 수에 씀 */
export function visitorHash(req: Request, salt: string): string {
  const userAgent = req.get('user-agent') ?? '';
  return createHash('sha256').update(`${salt}:${req.ip}:${userAgent}`).digest('hex');
}

/** IP 단위. 누적 방문 수는 같은 IP 를 브라우저와 상관없이 한 번만 셈 */
export function ipHash(req: Request, salt: string): string {
  return hashIp(req.ip ?? '', salt);
}

/** ipHash 와 같은 값. 요청 밖에서 IP 만 있을 때 씀 (봇 방어) */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:ip:${ip}`).digest('hex');
}
