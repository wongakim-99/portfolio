import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { Request } from 'express';

// 글쓰기처럼 본문이 있는 요청은 JSON 만 받음. 폼 전송으로 다른 사이트에서 보내는 요청을 한 번 더 막음
export function jsonOnly(req: Request): void {
  if (!req.is('application/json')) throw new UnsupportedMediaTypeException('JSON 요청만 받을 수 있습니다.');
}
