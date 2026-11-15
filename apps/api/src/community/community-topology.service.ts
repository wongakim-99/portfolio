import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Request } from 'express';
import type { Connection } from 'mongoose';
import { ServerService } from '../server/server.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { CommunityStorageService } from './community-storage.service.js';

// 관리실 '지금 서버' 구성도. 방문자 → Tailscale Funnel → web(Caddy) → api(NestJS) → mongo, minio
// 페이지는 2초마다 cursor 뒤의 이벤트를 받아 실제 간격대로 점을 흘려보냄
@Injectable()
export class CommunityTopologyService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly telemetry: TelemetryService,
    private readonly server: ServerService,
    private readonly storage: CommunityStorageService,
  ) {}

  async snapshot(req: Request, since?: string) {
    const cursor = /^\d{1,12}$/.test(since ?? '') ? Number(since) : undefined;
    const [host, minio] = await Promise.all([this.server.status(), this.storage.health()]);
    const memory = process.memoryUsage();
    return {
      now: Date.now(),
      cursor: this.telemetry.cursor,
      events: this.telemetry.since(cursor),
      visitors: this.telemetry.activeVisitors(),
      rates: {
        http: this.telemetry.perMinute('http'),
        db: this.telemetry.perMinute('db'),
        storage: this.telemetry.perMinute('storage'),
      },
      nodes: {
        // 이 요청이 Caddy 를 거쳐 왔으면 X-Forwarded-For 가 붙어 있음. 로컬 개발에서는 API 로 바로 들어옴
        web: { up: true, proxied: Boolean(req.get('x-forwarded-for')) },
        api: { up: true, uptime: Math.round(process.uptime()), memoryMb: Math.round(memory.rss / 1024 / 1024), httpMs: this.telemetry.averageMs('http') },
        mongo: { up: this.connection.readyState === 1, ms: this.telemetry.averageMs('db') },
        minio: minio ? { up: minio.up, ms: minio.ms } : null,
      },
      host,
    };
  }
}
