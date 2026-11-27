import { cx } from '@shared/lib';

const WIDTH = 120;
const HEIGHT = 30;

interface SparklineProps {
  values: (number | null)[];
  /** 막대(요청 수처럼 세는 값) 또는 선(시간, 비율처럼 재는 값) */
  kind?: 'line' | 'bars';
  tone?: 'warn' | 'bad';
  /** 이 값을 위 끝으로. 없으면 가장 큰 값 */
  max?: number;
}

/** 카드 아래 연필 선 그래프. 서버가 꺼져 있던 칸(null)은 선을 끊음 */
export function Sparkline({ values, kind = 'line', tone, max }: SparklineProps) {
  const top = Math.max(max ?? 0, ...values.map((value) => value ?? 0)) || 1;
  const step = WIDTH / Math.max(1, values.length);
  const y = (value: number) => HEIGHT - 1 - (value / top) * (HEIGHT - 3);

  if (kind === 'bars') {
    return (
      <svg className={cx('console-spark', tone && `is-${tone}`)} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <line className="console-spark-base" x1="0" x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} />
        {values.map((value, index) =>
          value ? <rect key={index} x={index * step + step * 0.15} width={step * 0.7} y={y(value)} height={HEIGHT - 1 - y(value)} /> : null,
        )}
      </svg>
    );
  }

  // null 에서 끊어 여러 줄로
  const runs: string[] = [];
  let run: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length) runs.push(run.join(' '));
      run = [];
      return;
    }
    run.push(`${(index * step + step / 2).toFixed(1)},${y(value).toFixed(1)}`);
  });
  if (run.length) runs.push(run.join(' '));

  return (
    <svg className={cx('console-spark', tone && `is-${tone}`)} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      <line className="console-spark-base" x1="0" x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} />
      {runs.map((points, index) =>
        points.includes(' ') ? (
          <polyline key={index} points={points} vectorEffect="non-scaling-stroke" />
        ) : (
          // 한 칸뿐인 줄은 점으로
          <circle key={index} cx={points.split(',')[0]} cy={points.split(',')[1]} r="1.4" />
        ),
      )}
    </svg>
  );
}
