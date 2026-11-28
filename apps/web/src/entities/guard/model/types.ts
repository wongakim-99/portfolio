// GET /api/community/admin/guard 응답 (apps/api/src/modules/guard). 주소는 끝을 가린 것(203.0.113.*)만 옴
export type GuardKind = 'scanner' | 'throttled' | 'login' | 'honeypot';

export const GUARD_LABEL: Record<GuardKind, string> = {
  scanner: '털기 주소',
  throttled: '횟수 초과',
  login: '로그인 실패',
  honeypot: '숨은 칸',
};

export interface GuardBan {
  id: string;
  ip: string;
  kind: GuardKind;
  reason: string;
  since: string;
  until: string;
  /** 막혀 있는 동안 돌려보낸 요청 수 */
  blocked: number;
}

export interface GuardEvent {
  at: string;
  kind: GuardKind;
  ip: string;
  method: string;
  path: string;
  agent: string;
}

export interface GuardOverview {
  keepDays: number;
  /** 최근 24시간 */
  counts: Record<GuardKind, number>;
  rules: { kind: GuardKind; count: number; hours: number }[];
  bans: GuardBan[];
  topIps: { ip: string; count: number; kinds: GuardKind[] }[];
  events: GuardEvent[];
}
