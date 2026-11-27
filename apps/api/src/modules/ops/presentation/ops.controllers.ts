import { BadRequestException, Controller, Get, Header, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RequirePermission } from '../../identity/index.js';
import { PerformanceService } from '../application/performance.service.js';
import { TopologyService } from '../application/topology.service.js';
import { isMetricsRange } from '../domain/metrics.js';
import { DatabaseProbe, ServerStatusSource } from '../domain/server-status.js';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly database: DatabaseProbe) {}

  // 배포 스크립트가 이 응답으로 새 버전이 떴는지 판단함
  @Get()
  async check() {
    const db = await this.database.ping();
    const body = { status: db === 'up' ? 'ok' : 'error', db, uptime: Math.round(process.uptime()) };
    if (db !== 'up') throw new ServiceUnavailableException(body);
    return body;
  }
}

@Controller('server')
export class ServerController {
  constructor(private readonly server: ServerStatusSource) {}

  @Get()
  status() {
    return this.server.status();
  }
}

@Controller('community/admin/topology')
export class TopologyController {
  constructor(private readonly topology: TopologyService) {}

  @Get()
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('server:read')
  snapshot(@Req() req: Request, @Query('since') since?: string) {
    return this.topology.snapshot(Boolean(req.get('x-forwarded-for')), since);
  }
}

// 관리실 '서버 상태'. 맨 위 점검표와 기간별 그래프, 느린 경로, DB, 노트북, 프로세스. 화면이 15초마다 부름
@Controller('community/admin/performance')
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get()
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('server:read')
  view(@Query('range') range?: string) {
    const picked = range ?? '1h';
    if (!isMetricsRange(picked)) throw new BadRequestException('기간은 1h, 6h, 24h, 7d 가운데 하나입니다.');
    return this.performance.view(picked);
  }
}
