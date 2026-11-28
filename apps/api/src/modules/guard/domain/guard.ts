// 봇 방어. 흔한 털기 주소, 횟수 제한 초과, 로그인 실패, 숨은 칸(honeypot)을 IP 별로 세고, 넘치면 그 IP 의 API 요청을 한동안 막음
// IP 원문은 남기지 않음. 맞춰 보는 데는 salt 섞은 해시, 화면에는 끝을 가린 주소(203.0.113.*)만 씀

export const GUARD_KINDS = ['scanner', 'throttled', 'login', 'honeypot'] as const;
export type GuardKind = (typeof GUARD_KINDS)[number];

export const GUARD_LABEL: Record<GuardKind, string> = {
  scanner: '털기 주소',
  throttled: '횟수 초과',
  login: '로그인 실패',
  honeypot: '숨은 칸',
};

/** 10분 안에 count 번 쌓이면 hours 시간 막음. 털기 주소와 숨은 칸은 사람이 할 일이 없어 빨리, 길게 막음 */
export const BAN_RULES: Record<GuardKind, { count: number; hours: number }> = {
  scanner: { count: 3, hours: 24 },
  honeypot: { count: 1, hours: 24 },
  login: { count: 8, hours: 1 },
  throttled: { count: 30, hours: 1 },
};
export const WINDOW_MS = 10 * 60_000;
/** 이상 징후 기록을 남겨 두는 날 수 */
export const KEEP_EVENT_DAYS = 30;
/** 한 IP 가 1분에 기록으로 남길 수 있는 줄 수. 무더기로 두드려도 DB 가 차지 않게 함 (세기는 다 셈) */
export const WRITES_PER_MINUTE = 20;

export interface GuardEvent {
  at: Date;
  kind: GuardKind;
  ipHash: string;
  /** 끝을 가린 주소 */
  ip: string;
  method: string;
  path: string;
  agent: string;
}

export interface GuardBan {
  id: string;
  ipHash: string;
  ip: string;
  kind: GuardKind;
  /** 막은 까닭 한 줄 */
  reason: string;
  since: Date;
  until: Date;
  /** 막혀 있는 동안 돌려보낸 요청 수 */
  blocked: number;
}

export const banReason = (kind: GuardKind) => `10분 안에 ${GUARD_LABEL[kind]} ${BAN_RULES[kind].count}번`;

const unmapped = (ip: string) => (ip.startsWith('::ffff:') ? ip.slice(7) : ip);

/** 비교할 때 쓰는 모양. IPv4 를 담은 IPv6(::ffff:1.2.3.4)는 IPv4 로, IPv6 는 소문자로 */
export const normalizeIp = (ip: string) => unmapped(ip.trim()).toLowerCase();

/** IPv4 는 마지막 칸, IPv6 는 앞 세 칸 뒤를 가림 */
export function maskIp(raw: string): string {
  const ip = unmapped(raw);
  if (ip.includes('.')) return ip.split('.').slice(0, 3).concat('*').join('.');
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:*`;
  return '알 수 없음';
}

/**
 * 세지도 막지도 않는 주소. 서버 안쪽(loopback, Docker 사설망)과 tailnet(100.64.0.0/10)
 * 주인장이 집이나 tailnet 에서 들어오다 막히는 일이 없게 하고, 배포 헬스체크도 여기서 옴
 */
export function isExempt(raw: string): boolean {
  const ip = unmapped(raw).toLowerCase();
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('fe80:') || /^f[cd]/.test(ip)) return true;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts as [number, number, number, number];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254);
}

// 검색 엔진, 수집기, 스크립트, 털기 도구가 스스로 밝히는 이름
const BOT_AGENT = /bot\b|bot\/|crawl|spider|slurp|headless|phantomjs|python-requests|python-urllib|aiohttp|curl\/|wget|go-http-client|okhttp|axios|node-fetch|undici|scrapy|httpclient|java\/|libwww|zgrab|masscan|nmap|nikto|sqlmap|nuclei/i;

/** 사람의 브라우저가 아니라고 스스로 밝힌 User-Agent. 비었으면 봇으로 봄 */
export const isBotAgent = (agent: string) => !agent.trim() || BOT_AGENT.test(agent);

export abstract class GuardStore {
  abstract record(event: GuardEvent): Promise<void>;
  /** 최근 것부터 */
  abstract events(since: Date, limit: number): Promise<GuardEvent[]>;
  abstract counts(since: Date): Promise<{ kind: GuardKind; count: number }[]>;
  abstract topIps(since: Date, limit: number): Promise<{ ip: string; count: number; kinds: GuardKind[] }[]>;
  abstract ban(ban: Omit<GuardBan, 'id' | 'blocked'>): Promise<GuardBan>;
  /** 아직 풀리지 않은 것 */
  abstract activeBans(now: Date): Promise<GuardBan[]>;
  /** 지금 풂. 없으면 null */
  abstract lift(id: string, now: Date): Promise<GuardBan | null>;
  abstract addBlocked(counts: ReadonlyMap<string, number>): Promise<void>;
}

/** 관리 패널(gawon-control)의 'IP 차단' 목록. 패널이 서버의 공유 폴더에 파일로 쓰고 api 가 읽음. 못 읽으면 빈 목록 */
export abstract class GuardBlocklist {
  abstract read(): Promise<string[]>;
}
