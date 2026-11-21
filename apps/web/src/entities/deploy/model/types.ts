// GET /api/deploys 응답 (apps/api/src/deploys). deploy/deploy.sh 가 배포를 마칠 때마다 한 건씩 남김
export interface DeployRecord {
  /** 커밋 앞 7자 */
  commit: string;
  subject: string;
  deployedAt: string;
  /** 이미지를 만들고 교체해 확인까지 걸린 시간 */
  durationSec: number;
  result: 'success' | 'rolled-back';
}
