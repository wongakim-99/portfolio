// 홈서버 배포 기록. deploy/deploy.sh 가 배포를 마칠 때마다 남기고, 홈의 영수증과 숨은 터미널의 git log 가 읽음
export const DEPLOY_RESULTS = ['success', 'rolled-back'] as const;
export type DeployResult = (typeof DEPLOY_RESULTS)[number];

export interface Deploy {
  /** 커밋 앞 7자 */
  commit: string;
  /** 커밋 제목 한 줄 */
  subject: string;
  deployedAt: Date;
  /** 이미지를 만들고 교체해 확인까지 마치는 데 걸린 시간 */
  durationSec: number;
  result: DeployResult;
}

export const shortCommit = (commit: string) => commit.slice(0, 7);

export abstract class DeployRepository {
  /** 같은 커밋, 같은 시각의 기록은 한 건만 남김 */
  abstract record(deploy: Deploy): Promise<void>;
  /** 최근 배포부터 */
  abstract latest(limit: number): Promise<Deploy[]>;
}
