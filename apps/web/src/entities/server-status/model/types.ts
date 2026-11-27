// GET /api/server 응답 (apps/api/src/modules/ops/domain/server-status.ts 의 ServerStatus)
export interface ServerStatus {
  uptime: number;
  load: number;
  cores: number;
  memoryUsedPercent: number;
  cpuTemp: number | null;
  battery: { percent: number; charging: boolean; pluggedIn: boolean | null } | null;
  release: { commit: string; deployedAt: string | null } | null;
}

/** 응답 시간(ms)까지 붙인 마지막 상태 */
export type ServerSnapshot = ServerStatus & { ping: number };

export type TelemetryKind = 'http' | 'db' | 'storage';
export interface TelemetryEvent {
  seq: number;
  at: number;
  kind: TelemetryKind;
  label: string;
  status: number;
  ms: number;
}

// GET /api/community/admin/topology 응답 (apps/api/src/modules/ops/application/topology.service.ts)
export interface TopologySnapshot {
  now: number;
  cursor: number;
  events: TelemetryEvent[];
  visitors: number;
  rates: Record<TelemetryKind, number>;
  nodes: {
    proxy: { up: boolean; proxied: boolean };
    api: { up: boolean; uptime: number; memoryMb: number; httpMs: number | null };
    mongo: { up: boolean; ms: number | null };
    minio: { up: boolean; ms: number } | null;
  };
  host: ServerStatus;
}

// GET /api/community/admin/performance 응답 (apps/api/src/modules/ops/application/performance.service.ts)
export type PerformanceRange = '1h' | '6h' | '24h' | '7d';
export type HealthLevel = 'good' | 'warn' | 'bad' | 'unknown';

export interface HealthCheck {
  key: string;
  label: string;
  level: HealthLevel;
  value: string;
  /** 정상이 아니면 한 문장, 확인 불가면 그 까닭 */
  reason: string | null;
}

/** 그래프 한 칸. 그 칸에 서버가 꺼져 있었으면 null */
export interface PerformancePoint {
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

export interface SlowRoute {
  route: string;
  count: number;
  avgMs: number;
  errors: number;
  timeShare: number;
}

export interface CollectionSize {
  name: string;
  count: number;
  size: number;
  storage: number;
  indexes: number;
}

export interface PerformanceView {
  range: PerformanceRange;
  computedAt: string;
  health: { level: HealthLevel; checks: HealthCheck[] };
  series: PerformancePoint[];
  totals: {
    requests: number;
    clientErrors: number;
    serverErrors: number;
    busiestMinute: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  };
  slowRoutes: SlowRoute[];
  process: {
    latest: { cpu: number; rss: number; heapUsed: number; heapTotal: number; lagP99: number; elu: number } | null;
    heapLimit: number;
    node: string;
    uptime: number;
    startedAt: string;
    sampleSeconds: number;
    savedMinutes: number;
    saveErrors: number;
  };
  host: {
    status: ServerStatus;
    loadAverage: number[];
    totalMemory: number;
    disk: { total: number; free: number } | null;
    container: { used: number; limit: number | null } | null;
  };
  database: {
    up: boolean;
    ms: number | null;
    version: string | null;
    totals: { objects: number; size: number; storage: number; indexes: number } | null;
    collections: CollectionSize[] | null;
    computedAt: string;
  };
  storage: { up: boolean; ms: number } | null;
  release: ServerStatus['release'];
}
