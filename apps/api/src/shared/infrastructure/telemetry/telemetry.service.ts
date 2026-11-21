import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { NextFunction, Request, Response } from 'express';
import type { Connection } from 'mongoose';
import { performance } from 'node:perf_hooks';
import { visitorHash } from '../../http/visitor-hash.js';

export type TelemetryKind = 'http' | 'db' | 'storage';
export interface TelemetryEvent { seq: number; at: number; kind: TelemetryKind; label: string; status: number; ms: number }

const KEEP_EVENTS = 400;
const VISITOR_WINDOW_MS = 5 * 60_000;
// 배포 헬스체크와 관리실이 2초마다 부르는 토폴로지 요청은 화면을 어지럽혀서 세지 않음
const QUIET_PATHS = new Set(['/api/health', '/api/community/admin/topology']);
const QUIET_COMMANDS = new Set(['ping', 'hello', 'isMaster', 'endSessions', 'buildInfo']);

// 관리실 토폴로지에 흘려보낼 최근 요청, DB 명령, 사진 저장소 작업. 메모리에 최근 것만 두고 재시작하면 비움
// 경로는 :id 같은 라우트 모양으로만 남기고, 방문자는 salt 섞은 해시로만 셈
@Injectable()
export class TelemetryService implements OnModuleInit {
  private seq = 0;
  private events: TelemetryEvent[] = [];
  private readonly visitors = new Map<string, number>();

  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit(): void {
    const client = this.connection.getClient();
    client.on('commandSucceeded', (event) => this.dbEvent(event.commandName, event.duration, 200));
    client.on('commandFailed', (event) => this.dbEvent(event.commandName, event.duration, 500));
  }

  private dbEvent(command: string, ms: number, status: number): void {
    if (!QUIET_COMMANDS.has(command)) this.record('db', command, ms, status);
  }

  record(kind: TelemetryKind, label: string, ms: number, status = 200): void {
    this.events.push({ seq: ++this.seq, at: Date.now(), kind, label, status, ms: Math.round(ms) });
    if (this.events.length > KEEP_EVENTS) this.events.splice(0, this.events.length - KEEP_EVENTS);
  }

  middleware(salt: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (QUIET_PATHS.has(req.path)) return next();
      const started = performance.now();
      res.on('finish', () => {
        // 맞는 라우트가 없으면 Nest 의 '*path' 같은 예비 경로에 잡히므로 한데 묶어 보여 줌
        const path = req.route?.path === undefined ? '' : String(req.route.path);
        const route = path && !path.includes('*') ? `${req.baseUrl}${path}` : '(없는 경로)';
        this.record('http', `${req.method} ${route}`, performance.now() - started, res.statusCode);
        this.visitors.set(visitorHash(req, salt), Date.now());
      });
      next();
    };
  }

  get cursor(): number {
    return this.seq;
  }

  since(cursor?: number): TelemetryEvent[] {
    const fresh = cursor === undefined ? this.events : this.events.filter((event) => event.seq > cursor);
    return fresh.slice(-150);
  }

  perMinute(kind: TelemetryKind): number {
    const from = Date.now() - 60_000;
    return this.events.filter((event) => event.kind === kind && event.at >= from).length;
  }

  averageMs(kind: TelemetryKind): number | null {
    const from = Date.now() - 60_000;
    const recent = this.events.filter((event) => event.kind === kind && event.at >= from);
    return recent.length ? Math.round(recent.reduce((sum, event) => sum + event.ms, 0) / recent.length) : null;
  }

  activeVisitors(): number {
    const from = Date.now() - VISITOR_WINDOW_MS;
    for (const [visitor, seen] of this.visitors) if (seen < from) this.visitors.delete(visitor);
    return this.visitors.size;
  }
}
