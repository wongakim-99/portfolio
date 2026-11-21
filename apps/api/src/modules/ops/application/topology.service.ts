import { Injectable } from '@nestjs/common';
import { ObjectStorage } from '../../../shared/infrastructure/storage/object-storage.js';
import { TelemetryService } from '../../../shared/infrastructure/telemetry/telemetry.service.js';
import { DatabaseProbe, ServerStatusSource } from '../domain/server-status.js';

// 관리실 '지금 서버' 구성도. 방문자 → Tailscale Funnel → proxy(Caddy) → api(NestJS) → mongo, minio
// 페이지(web, Next.js)도 proxy 뒤에 있지만 API 를 거치지 않아서 구성도에는 API 로 가는 길만 그림
// 페이지는 2초마다 cursor 뒤의 이벤트를 받아 실제 간격대로 점을 흘려보냄
@Injectable()
export class TopologyService {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly server: ServerStatusSource,
    private readonly storage: ObjectStorage,
    private readonly database: DatabaseProbe,
  ) {}

  /** proxied 는 이 요청이 Caddy 를 거쳐 왔는지 (X-Forwarded-For 가 붙어 있음) */
  async snapshot(proxied: boolean, since?: string) {
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
        proxy: { up: true, proxied },
        api: { up: true, uptime: Math.round(process.uptime()), memoryMb: Math.round(memory.rss / 1024 / 1024), httpMs: this.telemetry.averageMs('http') },
        mongo: { up: this.database.connected, ms: this.telemetry.averageMs('db') },
        minio: minio ? { up: minio.up, ms: minio.ms } : null,
      },
      host,
    };
  }
}
