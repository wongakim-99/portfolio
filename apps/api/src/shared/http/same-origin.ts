import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

// 로그인 쿠키로 바뀌는 요청은 이 사이트에서 보낸 것만 받음
export function assertSameOrigin(req: Request): void {
  const origin = req.get('origin');
  if (origin) {
    // 운영에서는 Caddy 가 원래 Host 를 그대로 넘김. 로컬 개발에서는 Next dev 서버(:3001)가 /api 를 넘기며
    // Host 를 API 주소로 바꾸고 원래 주소는 X-Forwarded-Host 에 남기므로 개발에서만 그것도 봄
    const hosts = [req.get('host'), ...(process.env.NODE_ENV === 'production' ? [] : [req.get('x-forwarded-host')])];
    try {
      if (hosts.includes(new URL(origin).host)) return;
    } catch { /* invalid Origin */ }
    throw new ForbiddenException('이 페이지에서 다시 시도해 주세요.');
  }
  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new ForbiddenException('이 페이지에서 다시 시도해 주세요.');
  }
}
