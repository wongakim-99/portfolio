// 홈 누적 방문 수. 같은 IP 는 브라우저와 상관없이, 며칠 뒤 다시 와도 평생 한 번만 셈
// IP 원문은 저장하지 않고 salt 섞은 해시만 남김 (shared/http/visitor-hash.ts)
export const HOME_PAGE = 'home';

export abstract class VisitRepository {
  /** 이 방문자를 처음 봤으면 true. 이미 센 방문자면 false */
  abstract markVisitor(page: string, ipHash: string): Promise<boolean>;
  abstract increment(page: string): Promise<number>;
  abstract total(page: string): Promise<number>;
}
