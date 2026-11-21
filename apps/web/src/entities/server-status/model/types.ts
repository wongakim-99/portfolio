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
