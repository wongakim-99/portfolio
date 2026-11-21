// 홈서버 노트북 상태. 홈의 노트북 LED, 배포 영수증, 숨은 터미널, 관리실 구성도가 읽음
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

/** DB 가 붙어 있는지. 배포 헬스체크와 관리실 구성도가 씀 */
export abstract class DatabaseProbe {
  abstract readonly connected: boolean;
  abstract ping(): Promise<'up' | 'down'>;
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
