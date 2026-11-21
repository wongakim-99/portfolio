import { formatDuration, formatNumber, formatStamp } from '@shared/lib';
import { formatBattery, type ServerStatusState } from '@entities/server-status';
import './deploy-receipt.css';

const STEPS = ['main 에 push', 'typecheck, build', 'e2e 테스트', '새 릴리스로 교체', '헬스체크, 실패하면 되돌림'];

function sparkPoints(loads: number[]) {
  if (loads.length < 2) return '';
  const max = Math.max(...loads, 0.5);
  const step = 60 / (loads.length - 1);
  return loads.map((value, index) => `${(index * step).toFixed(1)},${(15 - (value / max) * 14).toFixed(1)}`).join(' ');
}

function commitText({ latest, online }: ServerStatusState) {
  if (online === false) return '응답 없음';
  if (!latest) return '불러오는 중';
  return latest.release ? latest.release.commit : '로컬 실행';
}

/** 배포 영수증. 숫자는 /api/server 를 10초마다 받은 실제 값 */
export function DeployReceipt({ server, visits }: { server: ServerStatusState; visits: number | null }) {
  const { latest } = server;
  const rows: [string, string][] = [
    ['켜진 지', latest ? formatDuration(latest.uptime) : '-'],
    ['CPU 온도', latest ? (latest.cpuTemp === null ? '센서 없음' : `${latest.cpuTemp}°C`) : '-'],
  ];
  const restRows: [string, string][] = [
    ['메모리', latest ? `${latest.memoryUsedPercent}%` : '-'],
    ['배터리', latest ? formatBattery(latest.battery) : '-'],
    ['응답 시간', latest ? `${latest.ping}ms` : '-'],
    ['누적 방문', visits === null ? '-' : formatNumber(visits)],
  ];
  const row = ([term, value]: [string, string]) => (
    <div key={term}>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <div className="receipt">
      <p className="r-head">
        GAWON-DEV
        <br />
        <span>배포 영수증</span>
      </p>
      <dl className="r-rows">
        {row(['버전', commitText(server)])}
        {row(['배포 시각', latest?.release?.deployedAt ? formatStamp(latest.release.deployedAt) : '-'])}
      </dl>
      <p className="r-sub">배포 순서</p>
      <ol className="r-steps">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="r-sub">지금 서버</p>
      <dl className="r-rows">
        {rows.map(row)}
        <div className="r-load">
          <dt>부하 (1분)</dt>
          <dd>
            <svg className="spark" viewBox="0 0 60 16" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={sparkPoints(server.loads)} />
            </svg>
            <span>{latest ? latest.load.toFixed(2) : '-'}</span>
          </dd>
        </div>
        {restRows.map(row)}
      </dl>
      <p className="r-path">브라우저 &rarr; Tailscale Funnel &rarr; Caddy &rarr; Next.js, NestJS &rarr; MongoDB</p>
      <p className="r-foot">감사합니다. 또 오세요</p>
      <span className="barcode" aria-hidden="true" />
    </div>
  );
}
