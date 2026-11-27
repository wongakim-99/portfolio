// 홈서버 노트북 상태. 홈의 노트북 LED, 배포 영수증, 숨은 터미널, 관리실 구성도와 서버 상태가 읽음
export interface ServerStatus {
  uptime: number;
  load: number;
  cores: number;
  memoryUsedPercent: number;
  cpuTemp: number | null;
  battery: { percent: number; charging: boolean; pluggedIn: boolean | null } | null;
  release: { commit: string; deployedAt: string | null } | null;
}

export abstract class ServerStatusSource {
  abstract status(): Promise<ServerStatus>;
}

/** 컬렉션 하나의 크기. size 는 압축 전, storage 는 디스크에 쓴 크기 */
export interface CollectionSize {
  name: string;
  count: number;
  size: number;
  storage: number;
  indexes: number;
}

export interface DatabaseFacts {
  version: string | null;
  /** 이 DB 전체 */
  totals: { objects: number; size: number; storage: number; indexes: number } | null;
  /** 큰 것부터. 못 읽으면 null */
  collections: CollectionSize[] | null;
}

/** DB 가 붙어 있는지. 배포 헬스체크와 관리실 구성도, 서버 상태가 씀 */
export abstract class DatabaseProbe {
  abstract readonly connected: boolean;
  abstract ping(): Promise<'up' | 'down'>;
  /** 한 번 다녀오는 시간(ms). 닿지 않으면 null */
  abstract latency(): Promise<number | null>;
  /** 버전과 컬렉션 크기. 가벼운 명령만 씀 */
  abstract describe(): Promise<DatabaseFacts>;
}

/** 관리실 서버 상태에만 보이는 노트북 정보. 홈의 노트북 LED 가 읽는 ServerStatus 에는 넣지 않음 */
export interface HostDetails {
  loadAverage: number[];
  totalMemory: number;
  /** api 컨테이너가 놓인 디스크 */
  disk: { total: number; free: number } | null;
  /** api 컨테이너 메모리(cgroup). limit 이 null 이면 한도 없음 */
  container: { used: number; limit: number | null } | null;
}

export abstract class HostDetailsSource {
  abstract details(): Promise<HostDetails>;
}

// 이미지를 만들 때 deploy.sh 가 커밋과 빌드 시각을 환경변수로 넣어 둠 (apps/api/Dockerfile)
export function readRelease(env: NodeJS.ProcessEnv): ServerStatus['release'] {
  const commit = env.RELEASE_COMMIT?.trim();
  if (!commit) return null;
  const builtAt = new Date(env.RELEASE_BUILT_AT ?? '');
  return {
    commit: commit.slice(0, 7),
    deployedAt: Number.isNaN(builtAt.getTime()) ? null : builtAt.toISOString(),
  };
}
