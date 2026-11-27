import { Injectable } from '@nestjs/common';
import { getHeapStatistics } from 'node:v8';
import { ObjectStorage } from '../../../shared/infrastructure/storage/object-storage.js';
import { assessHealth } from '../domain/health.js';
import { MetricsStore, MINUTE_MS, rangeStart, recentTraffic, summarizeRange, type MetricsRange, type OpsMinute } from '../domain/metrics.js';
import { DatabaseProbe, HostDetailsSource, readRelease, ServerStatusSource, type DatabaseFacts } from '../domain/server-status.js';
import { MetricsRecorder } from './metrics-recorder.js';

/** 기간이 길수록 오래 둠. 관리실이 15초마다 물어도 7일치를 매번 읽지 않게 함 */
const STORED_TTL: Record<MetricsRange, number> = { '1h': 10_000, '6h': MINUTE_MS, '24h': 2 * MINUTE_MS, '7d': 5 * MINUTE_MS };
/** 컬렉션 크기는 5분에 한 번만 셈 */
const DATABASE_TTL = 5 * MINUTE_MS;
const PING_TTL = 10_000;

interface Cached<T> {
  at: number;
  value: Promise<T>;
}

/**
 * 관리실 '서버 상태'. 가독 운영 콘솔의 성능, 시스템 칸처럼 맨 위 점검표, 기간별 그래프, 느린 경로, DB, 노트북, 프로세스, 배포를 한 번에 줌
 * 그래프는 ops_minutes 에 남긴 1분 줄과 메모리의 최근 분을 합쳐 그림
 */
@Injectable()
export class PerformanceService {
  private readonly cache = new Map<string, Cached<unknown>>();

  constructor(
    private readonly recorder: MetricsRecorder,
    private readonly store: MetricsStore,
    private readonly server: ServerStatusSource,
    private readonly hostDetails: HostDetailsSource,
    private readonly database: DatabaseProbe,
    private readonly storage: ObjectStorage,
  ) {}

  private cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<{ at: number; value: T }> {
    const hit = this.cache.get(key) as Cached<T> | undefined;
    const now = Date.now();
    if (hit && now - hit.at < ttl) return hit.value.then((value) => ({ at: hit.at, value }));
    const value = load();
    this.cache.set(key, { at: now, value });
    // 실패한 것은 남기지 않아 다음에 다시 물음
    value.catch(() => this.cache.delete(key));
    return value.then((loaded) => ({ at: now, value: loaded }));
  }

  /** DB 에 남긴 줄에 메모리의 최근 분을 더함. 같은 분이 둘 다 있으면 DB 쪽을 씀 */
  private async rows(range: MetricsRange, now: number): Promise<OpsMinute[]> {
    const from = rangeStart(range, now);
    const { value: stored } = await this.cached(`rows:${range}`, STORED_TTL[range], () => this.store.since(new Date(from)).catch(() => [] as OpsMinute[]));
    const seen = new Set(stored.map((row) => row.minute.getTime()));
    const memory = this.recorder.minutes().filter((row) => row.minute.getTime() >= from && !seen.has(row.minute.getTime()));
    return [...stored, ...memory];
  }

  async view(range: MetricsRange, now = Date.now()) {
    const [rows, status, host, dbMs, storage, facts] = await Promise.all([
      this.rows(range, now),
      this.server.status(),
      this.hostDetails.details(),
      this.cached('ping', PING_TTL, () => this.database.latency()),
      this.storage.health(),
      this.cached<DatabaseFacts>('database', DATABASE_TTL, () => this.database.describe()),
    ]);
    // 최근 5분 판정은 DB 에 남긴 것과 상관없이 메모리의 분으로 봄 (1시간 그래프 줄은 10초 늦을 수 있음)
    const recent = recentTraffic(this.recorder.minutes(), Math.floor(now / MINUTE_MS) * MINUTE_MS - 4 * MINUTE_MS);
    const lastMinute = this.recorder.samples(now - MINUTE_MS);
    const latest = lastMinute[lastMinute.length - 1] ?? null;
    const heapLimit = getHeapStatistics().heap_size_limit;
    const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
    const db = { up: dbMs.value !== null, ms: dbMs.value };

    const health = assessHealth({
      recent,
      cpu: average(lastMinute.map((sample) => sample.cpu)),
      lagP99Ms: lastMinute.length ? Math.max(...lastMinute.map((sample) => sample.lagP99)) : null,
      heapRatio: latest ? latest.heapUsed / heapLimit : null,
      hostMemoryRatio: status.memoryUsedPercent / 100,
      cpuTemp: status.cpuTemp,
      battery: status.battery,
      db,
      storage,
      diskUsedRatio: host.disk && host.disk.total ? 1 - host.disk.free / host.disk.total : null,
    });

    const { series, totals, slowRoutes } = summarizeRange(rows, range, now);
    const stats = this.recorder.stats();
    return {
      range,
      computedAt: new Date(now).toISOString(),
      health,
      series,
      totals,
      slowRoutes,
      process: {
        latest: latest && { cpu: latest.cpu, rss: latest.rss, heapUsed: latest.heapUsed, heapTotal: latest.heapTotal, lagP99: latest.lagP99, elu: latest.elu },
        heapLimit,
        node: process.version,
        uptime: Math.floor(process.uptime()),
        startedAt: new Date(now - process.uptime() * 1000).toISOString(),
        sampleSeconds: stats.sampleSeconds,
        savedMinutes: stats.saved,
        saveErrors: stats.saveErrors,
      },
      host: { ...host, status },
      database: { ...db, ...facts.value, computedAt: new Date(facts.at).toISOString() },
      storage,
      release: readRelease(process.env),
    };
  }
}
