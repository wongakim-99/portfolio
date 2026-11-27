'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cx, formatDuration } from '@shared/lib';
import { formatDeployDuration, getDeploys, type DeployRecord } from '@entities/deploy';
import { formatBattery, type HealthCheck, type HealthLevel, type PerformanceRange, type PerformanceView } from '@entities/server-status';
import { formatBytes, formatCount, formatMs, formatRate, formatRatio } from '../lib/format';
import { usePerformance } from '../model/use-performance';
import { Sparkline } from './sparkline';
import './server-console.css';

const RANGES: { value: PerformanceRange; label: string; minutes: number }[] = [
  { value: '1h', label: '1시간', minutes: 60 },
  { value: '6h', label: '6시간', minutes: 360 },
  { value: '24h', label: '24시간', minutes: 1440 },
  { value: '7d', label: '7일', minutes: 10080 },
];

const VERDICT: Record<HealthLevel, string> = { good: '이상 없음', warn: '살펴볼 것', bad: '문제 있음', unknown: '판단 전' };
const clock = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const dateTime = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

interface ServerConsoleProps {
  /** 그래프 카드 아래에 끼울 '지금 흐름' 구성도. 관리실 화면이 넣어 줌 */
  live?: ReactNode;
}

/**
 * 관리실 '서버 상태'. 가독 운영 콘솔의 성능, 시스템 칸을 이 서버에 맞춘 것
 * 맨 위 점검표(LED 한 줄씩), 고른 기간의 그래프 카드, 느린 경로, 저장소, 노트북, 프로세스, 배포 순서
 */
export function ServerConsole({ live }: ServerConsoleProps) {
  const [range, setRange] = useState<PerformanceRange>('1h');
  const { data, error } = usePerformance(range);
  const stale = data && data.range !== range;
  const meta = error ?? (data ? `15초마다 갱신, ${clock.format(new Date(data.computedAt))}` : '모으는 중');

  return (
    <>
      <section className="admin-block console" aria-labelledby="console-title">
        <div className="community-section-head">
          <h3 id="console-title">서버 상태</h3>
          <span className="community-meta">{meta}</span>
        </div>
        <p className="console-lead">API 서버와 노트북이 지금 괜찮은지, 요청이 느려지지 않았는지 한 장에 봐요.</p>
        {data ? <CheckSheet health={data.health} /> : <div className="console-check is-waiting" aria-hidden="true" />}
      </section>

      <section className={cx('admin-block console', stale && 'is-stale')} aria-labelledby="console-trend-title">
        <div className="community-section-head">
          <h3 id="console-trend-title">지난 {RANGES.find((item) => item.value === range)?.label}</h3>
          <div className="console-range" role="group" aria-label="집계 기간">
            {RANGES.map((item) => (
              <button key={item.value} type="button" aria-pressed={item.value === range} onClick={() => setRange(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {data && <Tiles data={data} minutes={RANGES.find((item) => item.value === data.range)!.minutes} />}
      </section>

      {live}

      {data && (
        <>
          <section className="admin-block console" aria-labelledby="console-routes-title">
            <div className="community-section-head">
              <h3 id="console-routes-title">느린 경로</h3>
              <span className="community-meta">평균 응답이 긴 순서, 5번 넘게 불린 것만</span>
            </div>
            <SlowRoutes data={data} />
          </section>

          <section className="admin-block console" aria-labelledby="console-store-title">
            <div className="community-section-head">
              <h3 id="console-store-title">저장소</h3>
              <span className="community-meta">컬렉션 크기는 5분에 한 번 셈, {clock.format(new Date(data.database.computedAt))}</span>
            </div>
            <Stores data={data} />
          </section>

          <section className="admin-block console" aria-labelledby="console-machine-title">
            <div className="community-section-head">
              <h3 id="console-machine-title">노트북과 프로세스</h3>
            </div>
            <div className="console-panels">
              <HostPanel data={data} />
              <ProcessPanel data={data} />
              <ReleasePanel data={data} />
            </div>
          </section>
        </>
      )}
    </>
  );
}

/** 맨 위 점검표. 왼쪽에 판정 도장, 아래에 항목마다 LED 한 줄 */
function CheckSheet({ health }: { health: PerformanceView['health'] }) {
  const problems = health.checks.filter((check) => check.level === 'warn' || check.level === 'bad');
  return (
    <div className={cx('console-check', `is-${health.level}`)}>
      <div className="console-check-head">
        <p className="console-verdict">{VERDICT[health.level]}</p>
        {problems.length ? (
          <ul className="console-problems">
            {problems.map((check) => (
              <li key={check.key} className={`is-${check.level}`}>
                {check.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="console-calm">응답 지연, 오류, CPU, 메모리, 온도, 전원, DB, 사진 저장소, 디스크를 모두 기준 안에서 지켜보고 있어요.</p>
        )}
      </div>
      <ul className="console-leds">
        {health.checks.map((check) => (
          <CheckLed key={check.key} check={check} />
        ))}
      </ul>
      <p className="console-note">요청은 최근 5분, 프로세스는 최근 1분으로 판정해요.</p>
    </div>
  );
}

function CheckLed({ check }: { check: HealthCheck }) {
  return (
    <li className={`is-${check.level}`} title={check.reason ?? undefined}>
      <i aria-hidden="true" />
      <span>{check.label}</span>
      <b>{check.value}</b>
    </li>
  );
}

interface TileProps {
  label: string;
  value: string;
  sub: string;
  values: (number | null)[];
  kind?: 'line' | 'bars';
  tone?: 'warn' | 'bad';
  max?: number;
}

function Tile({ label, value, sub, values, kind, tone, max }: TileProps) {
  return (
    <div className={cx('console-tile', tone && `is-${tone}`)}>
      <p className="console-tile-label">{label}</p>
      {/* 숫자가 없는 값(재는 중, 센서 없음)은 본문 글꼴로 작게 */}
      <p className={cx('console-tile-value', !/\d/.test(value) && 'is-muted')}>{value}</p>
      <p className="console-tile-sub">{sub}</p>
      <Sparkline values={values} kind={kind} tone={tone} max={max} />
    </div>
  );
}

function Tiles({ data, minutes }: { data: PerformanceView; minutes: number }) {
  const { series, totals, process, host } = data;
  const pick = <K extends keyof (typeof series)[number]>(key: K) => series.map((point) => point[key] as number | null);
  // 서버가 켜져 있던 분만으로 평균을 냄
  const covered = series.filter((point) => point.requests !== null).length * (minutes / series.length);
  const perMinute = covered ? totals.requests / covered : 0;
  const latest = process.latest;
  const heapRatio = latest ? latest.heapUsed / process.heapLimit : null;
  const temp = host.status.cpuTemp;
  return (
    <div className="console-tiles">
      <Tile
        label="분당 요청"
        value={formatRate(perMinute)}
        sub={`가장 바쁜 분 ${formatCount(totals.busiestMinute)}건, 합계 ${formatCount(totals.requests)}건`}
        values={pick('requests')}
        kind="bars"
      />
      <Tile
        label="응답 시간 p95"
        value={formatMs(totals.p95)}
        sub={`p50 ${formatMs(totals.p50)}, p99 ${formatMs(totals.p99)}`}
        values={pick('p95')}
        tone={totals.p95 !== null && totals.p95 >= 2500 ? 'bad' : totals.p95 !== null && totals.p95 >= 1000 ? 'warn' : undefined}
      />
      <Tile
        label="서버 오류 (5xx)"
        value={`${formatCount(totals.serverErrors)}건`}
        sub={totals.requests ? `요청의 ${formatRatio(totals.serverErrors / totals.requests)}` : '요청 없음'}
        values={pick('serverErrors')}
        kind="bars"
        tone={totals.serverErrors ? 'bad' : undefined}
      />
      <Tile
        label="거절 (4xx)"
        value={`${formatCount(totals.clientErrors)}건`}
        sub="로그인, 권한, 없는 주소. 대부분 정상 흐름"
        values={pick('clientErrors')}
        kind="bars"
      />
      <Tile
        label="API CPU"
        value={latest ? formatRatio(latest.cpu) : '재는 중'}
        sub="한 코어 기준, 최근 10초"
        values={pick('cpu')}
        max={0.2}
        tone={latest && latest.cpu >= 0.9 ? 'bad' : latest && latest.cpu >= 0.7 ? 'warn' : undefined}
      />
      <Tile
        label="메모리 (RSS)"
        value={latest ? formatBytes(latest.rss) : '재는 중'}
        sub={latest && heapRatio !== null ? `힙 ${formatBytes(latest.heapUsed)}, 한도의 ${formatRatio(heapRatio)}` : '힙 재는 중'}
        values={pick('rss')}
      />
      <Tile
        label="이벤트 루프 지연 p99"
        value={latest ? formatMs(latest.lagP99) : '재는 중'}
        sub={latest ? `쉬지 못한 시간 ${formatRatio(latest.elu)}` : '최근 10초'}
        values={pick('lagP99')}
        max={50}
        tone={latest && latest.lagP99 >= 500 ? 'bad' : latest && latest.lagP99 >= 100 ? 'warn' : undefined}
      />
      <Tile
        label="CPU 온도"
        value={temp === null ? '센서 없음' : `${temp}°C`}
        sub={`부하 ${host.status.load} / ${host.status.cores}코어`}
        values={pick('cpuTemp')}
        max={90}
        tone={temp !== null && temp >= 90 ? 'bad' : temp !== null && temp >= 80 ? 'warn' : undefined}
      />
    </div>
  );
}

function SlowRoutes({ data }: { data: PerformanceView }) {
  if (!data.slowRoutes.length) return <p className="console-empty">이 기간에 5번 넘게 불린 경로가 아직 없어요.</p>;
  const widest = Math.max(...data.slowRoutes.map((route) => route.timeShare));
  return (
    <div className="console-table-wrap">
      <table className="console-table">
        <thead>
          <tr>
            <th scope="col">경로</th>
            <th scope="col">평균</th>
            <th scope="col">호출</th>
            <th scope="col">5xx</th>
            <th scope="col">시간 몫</th>
          </tr>
        </thead>
        <tbody>
          {data.slowRoutes.map((route) => (
            <tr key={route.route}>
              <td className="console-route" title={route.route}>
                {route.route}
              </td>
              <td>{formatMs(route.avgMs)}</td>
              <td>{formatCount(route.count)}</td>
              <td className={cx(route.errors > 0 && 'is-bad')}>{route.errors}</td>
              <td>
                <span className="console-share">
                  <i style={{ width: `${Math.max(4, (route.timeShare / (widest || 1)) * 100)}%` }} />
                  {formatRatio(route.timeShare)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="console-rows">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stores({ data }: { data: PerformanceView }) {
  const { database, storage } = data;
  const collections = database.collections?.slice(0, 10) ?? null;
  return (
    <div className="console-stores">
      <div className="console-panel">
        <h4>MongoDB</h4>
        <Rows
          rows={[
            ['버전', database.version ?? '확인 불가'],
            ['응답', database.up ? `${formatMs(database.ms)}, 10초마다 ping` : '닿지 않음'],
            ['문서', database.totals ? `${formatCount(database.totals.objects)}개` : '확인 불가'],
            ['데이터', database.totals ? `${formatBytes(database.totals.size)}, 디스크 ${formatBytes(database.totals.storage)}` : '확인 불가'],
            ['색인', database.totals ? formatBytes(database.totals.indexes) : '확인 불가'],
          ]}
        />
        <h4>사진 저장소 (MinIO)</h4>
        <Rows rows={[['응답', storage ? (storage.up ? formatMs(storage.ms) : '닿지 않음') : '설정 없음']]} />
      </div>
      <div className="console-panel">
        <h4>큰 컬렉션</h4>
        {collections ? (
          <div className="console-table-wrap">
            <table className="console-table">
              <thead>
                <tr>
                  <th scope="col">컬렉션</th>
                  <th scope="col">문서</th>
                  <th scope="col">데이터</th>
                  <th scope="col">디스크</th>
                  <th scope="col">색인</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.name}>
                    <td className="console-route">{collection.name}</td>
                    <td>{formatCount(collection.count)}</td>
                    <td>{formatBytes(collection.size)}</td>
                    <td>{formatBytes(collection.storage)}</td>
                    <td>{formatBytes(collection.indexes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="console-empty">컬렉션 크기를 읽지 못했어요.</p>
        )}
      </div>
    </div>
  );
}

function HostPanel({ data }: { data: PerformanceView }) {
  const { status, loadAverage, totalMemory, disk } = data.host;
  return (
    <div className="console-panel">
      <h4>노트북 (gawon-dev)</h4>
      <Rows
        rows={[
          ['CPU 온도', status.cpuTemp === null ? '센서 없음' : `${status.cpuTemp}°C`],
          ['부하 평균', `${loadAverage.join(', ')} (${status.cores}코어)`],
          ['메모리', `${status.memoryUsedPercent}% / ${formatBytes(totalMemory)}`],
          ['배터리', formatBattery(status.battery)],
          ['디스크', disk ? `${formatBytes(disk.free)} 남음 / ${formatBytes(disk.total)}` : '확인 불가'],
          ['켜진 지', formatDuration(status.uptime)],
        ]}
      />
    </div>
  );
}

function ProcessPanel({ data }: { data: PerformanceView }) {
  const { process, host } = data;
  const latest = process.latest;
  return (
    <div className="console-panel">
      <h4>API 프로세스</h4>
      <Rows
        rows={[
          ['가동', `${formatDuration(process.uptime)} (${dateTime.format(new Date(process.startedAt))} 시작)`],
          ['힙', latest ? `${formatBytes(latest.heapUsed)} / ${formatBytes(latest.heapTotal)}, 한도 ${formatBytes(process.heapLimit)}` : '재는 중'],
          ['컨테이너 메모리', host.container ? `${formatBytes(host.container.used)}${host.container.limit ? ` / ${formatBytes(host.container.limit)}` : ', 한도 없음'}` : '확인 불가'],
          ['Node.js', process.node],
          ['표본', `${process.sampleSeconds}초마다, 1분 줄 ${formatCount(process.savedMinutes)}개 남김${process.saveErrors ? `, 실패 ${process.saveErrors}` : ''}`],
        ]}
      />
    </div>
  );
}

function ReleasePanel({ data }: { data: PerformanceView }) {
  const [deploys, setDeploys] = useState<DeployRecord[] | null>(null);
  useEffect(() => {
    let active = true;
    getDeploys(4).then((list) => active && setDeploys(list), () => active && setDeploys([]));
    return () => {
      active = false;
    };
  }, []);
  const release = data.release;
  return (
    <div className="console-panel">
      <h4>배포</h4>
      <Rows
        rows={[
          ['지금 버전', release?.commit ?? '로컬'],
          ['빌드', release?.deployedAt ? dateTime.format(new Date(release.deployedAt)) : '없음'],
        ]}
      />
      <ol className="console-deploys" aria-label="최근 배포">
        {deploys?.map((deploy) => (
          <li key={`${deploy.commit}-${deploy.deployedAt}`} className={cx(deploy.result !== 'success' && 'is-bad')}>
            <span>{deploy.commit}</span>
            <span title={deploy.subject}>{deploy.subject}</span>
            <span>{deploy.result === 'success' ? formatDeployDuration(deploy.durationSec) : '되돌림'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
