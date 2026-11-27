// 관리실 '서버 상태'의 1분 집계. 요청, API 프로세스, 노트북, DB, 사진 저장소를 1분에 한 줄로 남기고 기간별 그래프로 묶음
// 가독 운영 콘솔의 성능, 시스템 칸을 이 서버(노트북 한 대, 방문이 적음)에 맞게 줄인 것

/** 응답 시간 칸 경계(ms). 마지막 칸은 10초 넘게 걸린 요청 */
export const LATENCY_BOUNDS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000] as const;
export type Histogram = number[];

/** 1분 줄을 남겨 두는 날 수. 7일 그래프까지 그림 */
export const KEEP_DAYS = 7;
export const MINUTE_MS = 60_000;

export const emptyHistogram = (): Histogram => new Array<number>(LATENCY_BOUNDS.length + 1).fill(0);

export function addLatency(histogram: Histogram, ms: number): void {
  const index = LATENCY_BOUNDS.findIndex((bound) => ms <= bound);
  const slot = index === -1 ? LATENCY_BOUNDS.length : index;
  histogram[slot] = (histogram[slot] ?? 0) + 1;
}

export function mergeHistogram(into: Histogram, from: readonly number[]): Histogram {
  from.forEach((count, index) => {
    into[index] = (into[index] ?? 0) + count;
  });
  return into;
}

/** 백분위는 그 요청이 든 칸의 위 경계로 셈. 10초를 넘는 칸도 10초로 봄 */
export function percentile(histogram: readonly number[], q: number): number | null {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  const target = Math.max(1, Math.ceil(total * q));
  let seen = 0;
  for (let index = 0; index < histogram.length; index++) {
    seen += histogram[index] ?? 0;
    if (seen >= target) return LATENCY_BOUNDS[Math.min(index, LATENCY_BOUNDS.length - 1)]!;
  }
  return LATENCY_BOUNDS[LATENCY_BOUNDS.length - 1]!;
}

/** 라우트 모양 하나(GET /api/blog/posts/:id)의 한 분. errors 는 5xx */
export interface RouteStat {
  route: string;
  count: number;
  totalMs: number;
  errors: number;
}

export interface TrafficMinute {
  requests: number;
  clientErrors: number;
  serverErrors: number;
  latency: Histogram;
  routes: RouteStat[];
}

/** 10초마다 재는 API 프로세스 한 점. cpu 는 한 코어를 다 쓰면 1 */
export interface ProcessSample {
  at: number;
  cpu: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  /** 이벤트 루프가 멈춘 시간 p99(ms) */
  lagP99: number;
  /** 이벤트 루프가 일한 시간 비율 0~1 */
  elu: number;
}

/** 한 분 동안의 점을 한 줄로. 메모리와 지연은 최댓값, CPU 와 사용률은 평균 */
export interface ProcessMinute {
  samples: number;
  cpu: number;
  cpuMax: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  lagP99: number;
  elu: number;
}

export interface HostMinute {
  cpuTemp: number | null;
  load: number;
  memoryUsedPercent: number;
  battery: { percent: number; charging: boolean; pluggedIn: boolean | null } | null;
}

/** ops_minutes 한 줄. db, storage 가 null 이면 그 분에는 재지 않음(진행 중인 분, 설정 없음) */
export interface OpsMinute {
  minute: Date;
  traffic: TrafficMinute;
  process: ProcessMinute | null;
  host: HostMinute | null;
  db: { up: boolean; ms: number | null } | null;
  storage: { up: boolean; ms: number } | null;
}

export const emptyTraffic = (): TrafficMinute => ({ requests: 0, clientErrors: 0, serverErrors: 0, latency: emptyHistogram(), routes: [] });

const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

export function summarizeProcess(samples: readonly ProcessSample[]): ProcessMinute | null {
  if (!samples.length) return null;
  const pick = (key: keyof ProcessSample) => samples.map((sample) => sample[key]);
  return {
    samples: samples.length,
    cpu: round(average(pick('cpu'))),
    cpuMax: round(Math.max(...pick('cpu'))),
    rss: Math.max(...pick('rss')),
    heapUsed: Math.max(...pick('heapUsed')),
    heapTotal: Math.max(...pick('heapTotal')),
    lagP99: round(Math.max(...pick('lagP99')), 2),
    elu: round(average(pick('elu'))),
  };
}

/** 그래프 기간. step 분마다 한 칸 */
export const RANGES = {
  '1h': { minutes: 60, step: 1 },
  '6h': { minutes: 360, step: 5 },
  '24h': { minutes: 1440, step: 15 },
  '7d': { minutes: KEEP_DAYS * 1440, step: 120 },
} as const;
export type MetricsRange = keyof typeof RANGES;
export const isMetricsRange = (value: unknown): value is MetricsRange => typeof value === 'string' && Object.hasOwn(RANGES, value);

export const floorMinute = (time: number) => Math.floor(time / MINUTE_MS) * MINUTE_MS;

/** 그 기간 그래프의 첫 칸 시작 시각. 칸 경계를 맞춰 두어 몇 초 사이 다시 물어도 같은 칸이 나옴 */
export function rangeStart(range: MetricsRange, now: number): number {
  const { minutes, step } = RANGES[range];
  const stepMs = step * MINUTE_MS;
  return Math.floor(now / stepMs) * stepMs - (minutes / step - 1) * stepMs;
}

/** 그래프 한 칸. 그 칸에 남은 줄이 없으면(서버가 꺼져 있었음) 값은 null */
export interface SeriesPoint {
  at: string;
  /** 분당 요청 (칸 평균) */
  requests: number | null;
  clientErrors: number | null;
  serverErrors: number | null;
  p95: number | null;
  cpu: number | null;
  rss: number | null;
  lagP99: number | null;
  cpuTemp: number | null;
}

export interface RouteSummary {
  route: string;
  count: number;
  avgMs: number;
  errors: number;
  /** 서버가 요청 처리에 쓴 전체 시간 가운데 이 경로의 몫 */
  timeShare: number;
}

/** 방문이 적어 몇 번 안 불린 경로가 평균을 흔들지 않게, 이만큼은 불린 경로만 줄 세움 */
const SLOW_ROUTE_MIN_COUNT = 5;
const SLOW_ROUTES = 8;

export function summarizeRange(rows: readonly OpsMinute[], range: MetricsRange, now: number) {
  const { minutes, step } = RANGES[range];
  const start = rangeStart(range, now);
  const stepMs = step * MINUTE_MS;
  const buckets = Array.from({ length: minutes / step }, () => [] as OpsMinute[]);
  for (const row of rows) {
    const index = Math.floor((row.minute.getTime() - start) / stepMs);
    if (index >= 0 && index < buckets.length) buckets[index]!.push(row);
  }

  const latency = emptyHistogram();
  const routes = new Map<string, RouteStat>();
  let requests = 0;
  let clientErrors = 0;
  let serverErrors = 0;
  let busiestMinute = 0;
  const series: SeriesPoint[] = buckets.map((bucket, index) => {
    const at = new Date(start + index * stepMs).toISOString();
    if (!bucket.length) return { at, requests: null, clientErrors: null, serverErrors: null, p95: null, cpu: null, rss: null, lagP99: null, cpuTemp: null };
    const histogram = emptyHistogram();
    let bucketRequests = 0;
    let bucketClient = 0;
    let bucketServer = 0;
    for (const { traffic } of bucket) {
      mergeHistogram(histogram, traffic.latency);
      bucketRequests += traffic.requests;
      bucketClient += traffic.clientErrors;
      bucketServer += traffic.serverErrors;
      busiestMinute = Math.max(busiestMinute, traffic.requests);
      for (const route of traffic.routes) {
        const sum = routes.get(route.route) ?? { route: route.route, count: 0, totalMs: 0, errors: 0 };
        sum.count += route.count;
        sum.totalMs += route.totalMs;
        sum.errors += route.errors;
        routes.set(route.route, sum);
      }
    }
    mergeHistogram(latency, histogram);
    requests += bucketRequests;
    clientErrors += bucketClient;
    serverErrors += bucketServer;
    const processes = bucket.flatMap((row) => (row.process ? [row.process] : []));
    const temps = bucket.flatMap((row) => (row.host?.cpuTemp == null ? [] : [row.host.cpuTemp]));
    return {
      at,
      requests: round(bucketRequests / step, 2),
      clientErrors: bucketClient,
      serverErrors: bucketServer,
      p95: percentile(histogram, 0.95),
      cpu: processes.length ? round(average(processes.map((row) => row.cpu))) : null,
      rss: processes.length ? Math.max(...processes.map((row) => row.rss)) : null,
      lagP99: processes.length ? Math.max(...processes.map((row) => row.lagP99)) : null,
      cpuTemp: temps.length ? round(average(temps), 1) : null,
    };
  });

  const totalMs = [...routes.values()].reduce((sum, route) => sum + route.totalMs, 0);
  const slowRoutes: RouteSummary[] = [...routes.values()]
    .filter((route) => route.count >= SLOW_ROUTE_MIN_COUNT)
    .map((route) => ({
      route: route.route,
      count: route.count,
      avgMs: Math.round(route.totalMs / route.count),
      errors: route.errors,
      timeShare: totalMs ? round(route.totalMs / totalMs) : 0,
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, SLOW_ROUTES);

  return {
    series,
    totals: {
      requests,
      clientErrors,
      serverErrors,
      busiestMinute,
      p50: percentile(latency, 0.5),
      p95: percentile(latency, 0.95),
      p99: percentile(latency, 0.99),
    },
    slowRoutes,
  };
}

/** 최근 몇 분 요청을 합침. 건강 판정은 최근 5분으로 봄 */
export function recentTraffic(rows: readonly OpsMinute[], from: number) {
  const latency = emptyHistogram();
  let requests = 0;
  let serverErrors = 0;
  for (const row of rows) {
    if (row.minute.getTime() < from) continue;
    mergeHistogram(latency, row.traffic.latency);
    requests += row.traffic.requests;
    serverErrors += row.traffic.serverErrors;
  }
  return { requests, serverErrors, p95Ms: percentile(latency, 0.95) };
}

/** 1분 줄 저장소. 7일 지난 줄은 저장소가 알아서 지움 */
export abstract class MetricsStore {
  abstract save(row: OpsMinute): Promise<void>;
  /** from 부터 시각 순서로 */
  abstract since(from: Date): Promise<OpsMinute[]>;
}
