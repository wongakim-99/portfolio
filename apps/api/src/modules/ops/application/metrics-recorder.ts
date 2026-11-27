import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { monitorEventLoopDelay, performance, type ELDHistogram } from 'node:perf_hooks';
import { ObjectStorage } from '../../../shared/infrastructure/storage/object-storage.js';
import { TelemetryService, type TelemetryEvent } from '../../../shared/infrastructure/telemetry/telemetry.service.js';
import {
  addLatency, emptyTraffic, floorMinute, MetricsStore, summarizeProcess, type HostMinute, type OpsMinute, type ProcessSample, type TrafficMinute,
} from '../domain/metrics.js';
import { DatabaseProbe, ServerStatusSource } from '../domain/server-status.js';

const SAMPLE_MS = 10_000;
/** 이벤트 루프 지연을 재는 타이머 간격. 잰 값에 이 간격이 더해져 나와서 빼고 씀 */
const DELAY_RESOLUTION_MS = 20;
/** 저장이 실패해도 최근 1시간 그래프와 판정은 메모리로 그림 */
const KEEP_MINUTES = 90;
const KEEP_SAMPLES = 12;

/**
 * 서버 상태의 1분 집계를 모음. 요청은 TelemetryService 가 알려 줄 때마다 세고, API 프로세스는 10초마다 잼
 * 분이 바뀌면 노트북, DB, 사진 저장소를 한 번씩 재서 지난 분을 한 줄로 ops_minutes 에 남김
 */
@Injectable()
export class MetricsRecorder implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsRecorder.name);
  private readonly delay: ELDHistogram = monitorEventLoopDelay({ resolution: DELAY_RESOLUTION_MS });
  private minute = floorMinute(Date.now());
  private traffic = emptyTraffic();
  private routes = new Map<string, TrafficMinute['routes'][number]>();
  private pending: ProcessSample[] = [];
  private readonly closed: OpsMinute[] = [];
  private readonly recentSamples: ProcessSample[] = [];
  private cpuBefore = process.cpuUsage();
  private wallBefore = performance.now();
  private eluBefore = performance.eventLoopUtilization();
  private primed = false;
  private timer?: NodeJS.Timeout;
  private unlisten?: () => void;
  private saved = 0;
  private saveErrors = 0;

  constructor(
    private readonly telemetry: TelemetryService,
    private readonly server: ServerStatusSource,
    private readonly database: DatabaseProbe,
    private readonly storage: ObjectStorage,
    private readonly store: MetricsStore,
  ) {}

  onModuleInit(): void {
    this.delay.enable();
    this.unlisten = this.telemetry.listen((event) => this.count(event));
    this.timer = setInterval(() => this.tick(), SAMPLE_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.unlisten?.();
    this.delay.disable();
  }

  private count(event: TelemetryEvent): void {
    if (event.kind !== 'http') return;
    this.roll(event.at);
    const traffic = this.traffic;
    traffic.requests++;
    if (event.status >= 500) traffic.serverErrors++;
    else if (event.status >= 400) traffic.clientErrors++;
    addLatency(traffic.latency, event.ms);
    const route = this.routes.get(event.label) ?? { route: event.label, count: 0, totalMs: 0, errors: 0 };
    route.count++;
    route.totalMs += event.ms;
    if (event.status >= 500) route.errors++;
    this.routes.set(event.label, route);
  }

  /** 첫 측정은 기준값만 맞추고 버림. 서버가 뜨는 일이 섞여 CPU 가 높게 나옴 */
  private tick(): void {
    const sample = this.measure();
    if (!this.primed) {
      this.primed = true;
      return;
    }
    this.roll(sample.at);
    this.pending.push(sample);
    this.recentSamples.push(sample);
    if (this.recentSamples.length > KEEP_SAMPLES) this.recentSamples.shift();
  }

  private measure(): ProcessSample {
    const wall = performance.now();
    const cpu = process.cpuUsage();
    const elu = performance.eventLoopUtilization();
    const elapsedMs = Math.max(1, wall - this.wallBefore);
    const cpuMs = (cpu.user - this.cpuBefore.user + cpu.system - this.cpuBefore.system) / 1000;
    const utilization = performance.eventLoopUtilization(elu, this.eluBefore).utilization;
    this.cpuBefore = cpu;
    this.wallBefore = wall;
    this.eluBefore = elu;
    // 잰 것이 없으면 percentile 이 아주 큰 값을 돌려줄 수 있어 count 로 먼저 봄
    const lagP99 = this.delay.count > 0 ? Math.max(0, this.delay.percentile(99) / 1e6 - DELAY_RESOLUTION_MS) : 0;
    this.delay.reset();
    const memory = process.memoryUsage();
    return { at: Date.now(), cpu: cpuMs / elapsedMs, rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal, lagP99, elu: utilization };
  }

  /** 분이 바뀌었으면 지난 분을 닫음 */
  private roll(time: number): void {
    const minute = floorMinute(time);
    if (minute === this.minute) return;
    const row: OpsMinute = { minute: new Date(this.minute), traffic: this.takeTraffic(), process: summarizeProcess(this.pending), host: null, db: null, storage: null };
    this.pending = [];
    this.minute = minute;
    // 아무 일도 없던 분은 남기지 않음 (첫 측정 전 등)
    if (!row.traffic.requests && !row.process) return;
    // 노트북, DB 를 재는 동안에도 그래프에서 빠지지 않게 먼저 넣고 나중에 채움
    this.closed.push(row);
    if (this.closed.length > KEEP_MINUTES) this.closed.shift();
    void this.close(row);
  }

  private takeTraffic(): TrafficMinute {
    const traffic = { ...this.traffic, routes: [...this.routes.values()] };
    this.traffic = emptyTraffic();
    this.routes = new Map();
    return traffic;
  }

  private async close(row: OpsMinute): Promise<void> {
    const [host, dbMs, storage] = await Promise.all([this.host(), this.database.latency(), this.storage.health()]);
    Object.assign(row, { host, db: { up: dbMs !== null, ms: dbMs }, storage });
    try {
      await this.store.save(row);
      this.saved++;
    } catch (error) {
      if (this.saveErrors++ === 0) this.logger.warn(`ops_minutes 저장 실패: ${String(error)}`);
    }
  }

  private async host(): Promise<HostMinute | null> {
    try {
      const { cpuTemp, load, memoryUsedPercent, battery } = await this.server.status();
      return { cpuTemp, load, memoryUsedPercent, battery };
    } catch {
      return null;
    }
  }

  /** 메모리에 남은 닫힌 분과 아직 진행 중인 분. 진행 중인 분은 노트북, DB 값이 비어 있음 */
  minutes(): OpsMinute[] {
    const open: OpsMinute = { minute: new Date(this.minute), traffic: { ...this.traffic, routes: [...this.routes.values()] }, process: summarizeProcess(this.pending), host: null, db: null, storage: null };
    return open.traffic.requests || open.process ? [...this.closed, open] : [...this.closed];
  }

  /** 최근 since 이후 10초 점 */
  samples(since: number): ProcessSample[] {
    return this.recentSamples.filter((sample) => sample.at >= since);
  }

  /** 가장 최근에 닫은 분에 잰 DB, 사진 저장소 */
  lastClosed(): OpsMinute | null {
    return this.closed[this.closed.length - 1] ?? null;
  }

  stats() {
    return { sampleSeconds: SAMPLE_MS / 1000, saved: this.saved, saveErrors: this.saveErrors };
  }
}
