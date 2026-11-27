// 관리실 '서버 상태' 맨 위 점검표. 가독 운영 콘솔의 상태 판정을 노트북 한 대짜리 서버에 맞춤
// 방문이 적어 비율 대신 건수로 보는 것(5xx)이 있고, 노트북이라 CPU 온도와 전원을 같이 봄

export type HealthLevel = 'good' | 'warn' | 'bad' | 'unknown';

/** 판정에 쓰는 값. 못 읽은 값은 null */
export interface HealthInput {
  /** 최근 5분 요청 */
  recent: { requests: number; serverErrors: number; p95Ms: number | null };
  /** 최근 1분 API 프로세스 */
  cpu: number | null;
  lagP99Ms: number | null;
  heapRatio: number | null;
  hostMemoryRatio: number | null;
  cpuTemp: number | null;
  battery: { percent: number; charging: boolean; pluggedIn: boolean | null } | null;
  /** null 이면 아직 재지 않음 */
  db: { up: boolean; ms: number | null } | null;
  /** null 이면 사진 저장소 설정이 없음 */
  storage: { up: boolean; ms: number } | null;
  diskUsedRatio: number | null;
}

export interface HealthCheck {
  key: string;
  label: string;
  level: HealthLevel;
  /** 화면에 보일 지금 값 */
  value: string;
  /** 정상이 아니면 운영자가 읽을 한 문장, 확인 불가면 그 까닭 */
  reason: string | null;
}

export interface Health {
  level: HealthLevel;
  checks: HealthCheck[];
}

/** 응답 지연은 최근 5분에 이만큼은 요청이 있어야 판단함. 몇 건뿐이면 한 번 느린 것에 휘둘림 */
export const MIN_RECENT_REQUESTS = 10;

const ms = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}초` : `${Math.round(value)}ms`);
const pct = (ratio: number) => `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}%`;

interface Rule {
  key: string;
  label: string;
  /** 값이 클수록 나쁨. null 이면 확인 불가 */
  measure: (input: HealthInput) => number | null;
  unknownReason: (input: HealthInput) => string;
  warn: number;
  bad: number;
  show: (value: number, input: HealthInput) => string;
  reason: (value: number, input: HealthInput) => string;
}

const RULES: readonly Rule[] = [
  {
    key: 'latency',
    label: '응답 지연 p95',
    // 평소 이 서버 API 는 수십 ms. 1초부터 손님이 기다린다고 느낌
    measure: (input) => (input.recent.requests >= MIN_RECENT_REQUESTS ? input.recent.p95Ms : null),
    unknownReason: () => '최근 5분 요청이 적어 판단하지 않음',
    warn: 1000,
    bad: 2500,
    show: (value) => ms(value),
    reason: (value) => `최근 5분 응답 지연 p95 가 ${ms(value)}예요`,
  },
  {
    key: 'errors',
    label: '서버 오류(5xx)',
    // 방문이 적어 비율은 한 건에도 크게 흔들림. 한 건이라도 나면 살펴봄
    measure: (input) => input.recent.serverErrors,
    unknownReason: () => '',
    warn: 1,
    bad: 10,
    show: (value) => `${value}건`,
    reason: (value) => `최근 5분 서버 오류가 ${value}건 났어요`,
  },
  {
    key: 'cpu',
    label: 'API CPU',
    // Node 주 스레드는 한 코어가 끝. 70%부터 요청이 줄을 서기 시작함
    measure: (input) => input.cpu,
    unknownReason: () => '아직 재기 전',
    warn: 0.7,
    bad: 0.9,
    show: (value) => pct(value),
    reason: (value) => `API 프로세스가 한 코어의 ${pct(value)}를 쓰고 있어요`,
  },
  {
    key: 'lag',
    label: '이벤트 루프 지연',
    measure: (input) => input.lagP99Ms,
    unknownReason: () => '아직 재기 전',
    warn: 100,
    bad: 500,
    show: (value) => ms(value),
    reason: (value) => `이벤트 루프가 ${ms(value)}씩 멈췄어요 (p99)`,
  },
  {
    key: 'heap',
    label: '힙 사용',
    // 한도 가까이에서는 GC 가 몰려 응답이 끊기고, 넘으면 프로세스가 죽음
    measure: (input) => input.heapRatio,
    unknownReason: () => '아직 재기 전',
    warn: 0.8,
    bad: 0.9,
    show: (value) => `한도의 ${pct(value)}`,
    reason: (value) => `힙이 한도의 ${pct(value)}까지 찼어요`,
  },
  {
    key: 'memory',
    label: '노트북 메모리',
    // 컨테이너 다섯 개가 노트북 메모리 7.5GB 를 나눠 씀
    measure: (input) => input.hostMemoryRatio,
    unknownReason: () => '메모리를 읽지 못함',
    warn: 0.85,
    bad: 0.95,
    show: (value) => pct(value),
    reason: (value) => `노트북 메모리를 ${pct(value)} 쓰고 있어요`,
  },
  {
    key: 'temp',
    label: 'CPU 온도',
    measure: (input) => input.cpuTemp,
    unknownReason: () => '온도 센서 없음',
    warn: 80,
    bad: 90,
    show: (value) => `${value}°C`,
    reason: (value) => `CPU 온도가 ${value}°C 예요`,
  },
  {
    key: 'power',
    label: '전원',
    // 노트북이라 전원이 빠지면 배터리가 다 닳을 때 서버도 꺼짐. 0 은 전원 연결, 1 은 배터리, 2 는 배터리가 20% 아래
    measure: ({ battery }) => {
      if (!battery) return null;
      if (battery.charging || battery.pluggedIn) return 0;
      if (battery.pluggedIn === false) return battery.percent <= 20 ? 2 : 1;
      return null;
    },
    unknownReason: ({ battery }) => (battery ? '전원 어댑터를 읽지 못함' : '배터리 없음'),
    warn: 1,
    bad: 2,
    show: (value, { battery }) => (value === 0 ? '전원 연결' : `배터리 ${battery?.percent ?? 0}%`),
    reason: (_value, { battery }) => `전원이 빠져 배터리(${battery?.percent ?? 0}%)로 돌고 있어요`,
  },
  {
    key: 'db',
    label: 'DB 응답',
    // 같은 노트북 안의 MongoDB 라 평소 몇 ms
    measure: ({ db }) => (!db ? null : db.up && db.ms !== null ? db.ms : Number.POSITIVE_INFINITY),
    unknownReason: () => '아직 재기 전',
    warn: 100,
    bad: 1000,
    show: (value) => (Number.isFinite(value) ? ms(value) : '실패'),
    reason: (value) => (Number.isFinite(value) ? `DB 응답이 ${ms(value)}로 느려요` : 'DB 에 닿지 않아요'),
  },
  {
    key: 'storage',
    label: '사진 저장소',
    measure: ({ storage }) => (!storage ? null : storage.up ? storage.ms : Number.POSITIVE_INFINITY),
    unknownReason: () => '사진 저장소 설정 없음',
    warn: 500,
    bad: 2000,
    show: (value) => (Number.isFinite(value) ? ms(value) : '실패'),
    reason: (value) => (Number.isFinite(value) ? `사진 저장소 응답이 ${ms(value)}로 느려요` : '사진 저장소(MinIO)에 닿지 않아요'),
  },
  {
    key: 'disk',
    label: '디스크',
    measure: (input) => input.diskUsedRatio,
    unknownReason: () => '디스크를 읽지 못함',
    warn: 0.85,
    bad: 0.95,
    show: (value) => `${pct(1 - value)} 남음`,
    reason: (value) => `디스크 여유가 ${pct(1 - value)}밖에 없어요`,
  },
];

const RANK: Record<HealthLevel, number> = { unknown: 0, good: 1, warn: 2, bad: 3 };

export function assessHealth(input: HealthInput): Health {
  const checks = RULES.map((rule): HealthCheck => {
    const value = rule.measure(input);
    if (value === null || Number.isNaN(value)) {
      return { key: rule.key, label: rule.label, level: 'unknown', value: '확인 불가', reason: rule.unknownReason(input) || null };
    }
    const level: HealthLevel = value >= rule.bad ? 'bad' : value >= rule.warn ? 'warn' : 'good';
    return { key: rule.key, label: rule.label, level, value: rule.show(value, input), reason: level === 'good' ? null : rule.reason(value, input) };
  });
  const level = checks.reduce<HealthLevel>((worst, check) => (RANK[check.level] > RANK[worst] ? check.level : worst), 'unknown');
  return { level, checks };
}
