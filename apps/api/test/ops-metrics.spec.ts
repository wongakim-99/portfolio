import { assessHealth, type HealthInput } from '../src/modules/ops/domain/health.js';
import { addLatency, emptyHistogram, emptyTraffic, percentile, rangeStart, summarizeRange, type OpsMinute } from '../src/modules/ops/domain/metrics.js';

const MINUTE = 60_000;

const minute = (time: number, latencies: number[], status = 200, route = 'GET /api/blog/posts'): OpsMinute => {
  const traffic = emptyTraffic();
  for (const ms of latencies) {
    traffic.requests++;
    if (status >= 500) traffic.serverErrors++;
    else if (status >= 400) traffic.clientErrors++;
    addLatency(traffic.latency, ms);
  }
  traffic.routes = [{ route, count: latencies.length, totalMs: latencies.reduce((a, b) => a + b, 0), errors: status >= 500 ? latencies.length : 0 }];
  return { minute: new Date(time), traffic, process: { samples: 6, cpu: 0.02, cpuMax: 0.05, rss: 150e6, heapUsed: 50e6, heapTotal: 80e6, lagP99: 3, elu: 0.01 }, host: null, db: null, storage: null };
};

describe('서버 상태 1분 집계', () => {
  it('응답 시간 백분위는 그 요청이 든 칸의 위 경계로 셈', () => {
    const histogram = emptyHistogram();
    expect(percentile(histogram, 0.95)).toBeNull();
    for (let i = 0; i < 95; i++) addLatency(histogram, 3);
    for (let i = 0; i < 5; i++) addLatency(histogram, 800);
    expect(percentile(histogram, 0.5)).toBe(5);
    expect(percentile(histogram, 0.95)).toBe(5);
    expect(percentile(histogram, 0.99)).toBe(1000);
    addLatency(histogram, 60_000);
    expect(percentile(histogram, 1)).toBe(10_000);
  });

  it('기간을 칸으로 나누고, 줄이 없는 칸은 null 로 비우고, 느린 경로는 5번 넘게 불린 것만', () => {
    const now = Date.parse('2026-11-28T03:30:20Z');
    const start = rangeStart('1h', now);
    expect(now - start).toBeLessThan(60 * MINUTE);
    const rows = [
      minute(start, [10, 20, 30, 40, 50, 60]),
      minute(start + 2 * MINUTE, [3000], 500, 'POST /api/blog/posts'),
      minute(start + 59 * MINUTE, [5, 5]),
    ];
    const { series, totals, slowRoutes } = summarizeRange(rows, '1h', now);
    expect(series).toHaveLength(60);
    expect(series[0]).toMatchObject({ requests: 6, serverErrors: 0 });
    expect(series[1]).toMatchObject({ requests: null, p95: null, cpu: null });
    expect(series[2]).toMatchObject({ requests: 1, serverErrors: 1, p95: 5000 });
    expect(totals).toMatchObject({ requests: 9, serverErrors: 1, busiestMinute: 6 });
    expect(slowRoutes.map((route) => route.route)).toEqual(['GET /api/blog/posts']);
    expect(slowRoutes[0]).toMatchObject({ count: 8, avgMs: 28 });

    // 6시간은 5분 칸 72개. 같은 칸의 분은 분당 평균으로
    const six = summarizeRange(rows, '6h', now);
    expect(six.series).toHaveLength(72);
    expect(six.series.filter((point) => point.requests !== null).length).toBeGreaterThanOrEqual(2);
  });
});

describe('서버 상태 점검표', () => {
  const calm: HealthInput = {
    recent: { requests: 40, serverErrors: 0, p95Ms: 50 },
    cpu: 0.03,
    lagP99Ms: 4,
    heapRatio: 0.02,
    hostMemoryRatio: 0.4,
    cpuTemp: 48,
    battery: { percent: 80, charging: false, pluggedIn: true },
    db: { up: true, ms: 2 },
    storage: { up: true, ms: 8 },
    diskUsedRatio: 0.5,
  };

  it('모두 기준 안이면 이상 없음', () => {
    const health = assessHealth(calm);
    expect(health.level).toBe('good');
    expect(health.checks.every((check) => check.level === 'good' && check.reason === null)).toBe(true);
  });

  it('5xx 한 건, 전원 빠짐은 살펴볼 것, DB 가 닿지 않으면 문제', () => {
    const health = assessHealth({ ...calm, recent: { ...calm.recent, serverErrors: 1 }, battery: { percent: 64, charging: false, pluggedIn: false } });
    expect(health.level).toBe('warn');
    expect(health.checks.filter((check) => check.level === 'warn').map((check) => check.reason)).toEqual([
      '최근 5분 서버 오류가 1건 났어요',
      '전원이 빠져 배터리(64%)로 돌고 있어요',
    ]);
    const down = assessHealth({ ...calm, db: { up: false, ms: null } });
    expect(down.level).toBe('bad');
    expect(down.checks.find((check) => check.key === 'db')).toMatchObject({ value: '실패', reason: 'DB 에 닿지 않아요' });
  });

  it('요청이 적거나 센서가 없으면 판단하지 않고 까닭을 남김', () => {
    const health = assessHealth({ ...calm, recent: { requests: 3, serverErrors: 0, p95Ms: 4000 }, cpuTemp: null, battery: null, storage: null });
    const byKey = Object.fromEntries(health.checks.map((check) => [check.key, check]));
    expect(byKey.latency).toMatchObject({ level: 'unknown', reason: '최근 5분 요청이 적어 판단하지 않음' });
    expect(byKey.temp).toMatchObject({ level: 'unknown', reason: '온도 센서 없음' });
    expect(byKey.power).toMatchObject({ level: 'unknown', reason: '배터리 없음' });
    expect(health.level).toBe('good');
  });
});
