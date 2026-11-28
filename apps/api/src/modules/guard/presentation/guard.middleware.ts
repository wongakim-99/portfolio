import type { NextFunction, Request, Response } from 'express';
import type { GuardService } from '../application/guard.service.js';

const LOGIN_PATH = '/api/community/auth/login';

/**
 * 모든 API 요청 앞에서 막힌 IP 를 돌려보내고, 응답이 끝나면 횟수 제한(429)과 로그인 실패(401)를 셈
 * 막힌 IP 는 Nest 라우팅과 DB 까지 가지 않고 여기서 끝남
 */
export function guardMiddleware(guard: GuardService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? '';
    if (guard.banned(ip)) {
      res.status(403).json({ statusCode: 403, message: '수상한 요청이 많아 잠시 막은 주소입니다. 나중에 다시 와 주세요.' });
      return;
    }
    res.on('finish', () => {
      const kind = res.statusCode === 429 ? 'throttled' : res.statusCode === 401 && req.method === 'POST' && req.path === LOGIN_PATH ? 'login' : null;
      if (kind) void guard.note({ kind, ip, method: req.method, path: req.path, agent: req.get('user-agent') ?? '' });
    });
    next();
  };
}
