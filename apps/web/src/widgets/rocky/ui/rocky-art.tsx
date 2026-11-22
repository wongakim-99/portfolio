import { useId } from 'react';

// 제노나이트 공 바닥에 선 로키를 비스듬히 앞에서 본 모습. 소설 묘사와 영화 스틸의 특징(마른 진흙처럼 금 간 황토빛 바윗덩이 몸,
// 납작한 돌판 두 마디 다리, 골이 진 주름 관절, 세 손가락, 초록빛 도는 삼각 격자 공)을 참고해 이 사이트 톤으로 직접 그림. 공식 그림은 쓰지 않음

type P = readonly [number, number];

interface Leg {
  hip: P;
  elbow: P;
  foot: P;
  /** 걸을 때 번갈아 딛는 두 무리 */
  group: 'a' | 'b';
  /** 주먹 맞대기 때 드는 앞다리 */
  bump?: boolean;
}

// 뒤 다리 둘은 몸 뒤에, 옆 다리 둘과 앞 다리 하나는 몸 앞에 그림
// 무릎이 몸보다 높이 솟는 게, 거미 같은 자세 (영화 스틸처럼)
const BACK_LEGS: Leg[] = [
  { hip: [47, 48], elbow: [27, 36], foot: [33, 87], group: 'b' },
  { hip: [73, 48], elbow: [93, 36], foot: [87, 87], group: 'a' },
];
const FRONT_LEGS: Leg[] = [
  { hip: [43, 63], elbow: [19, 53], foot: [23, 99], group: 'a' },
  { hip: [77, 63], elbow: [101, 53], foot: [97, 99], group: 'b', bump: true },
  { hip: [58, 74], elbow: [49, 87], foot: [57, 104], group: 'b' },
];

// 몸: 울퉁불퉁한 바윗덩이. 오른쪽 어깨에 돌판 하나가 덮여 있고, 아래쪽은 그늘
const BODY = 'M35 63 C31 54 34 43 43 37 C47 33 53 31 58 32 C62 30 69 31 73 34 C82 38 89 47 87 58 C86 67 79 75 69 77 C64 79 55 79 50 77 C42 75 37 70 35 63 Z';
const PLATE = 'M66 34 C75 32 85 38 88 48 C89 53 87 56 85 55 C80 49 73 46 66 46 C63 42 63 37 66 34 Z';
const UNDERSIDE = 'M37 66 C45 75 74 76 85 63 C83 70 76 76 69 77 C63 79 55 79 50 77 C44 75 39 71 37 66 Z';
const HIGHLIGHT = 'M43 44 C47 38 54 35 59 37 C54 40 49 44 46 50 C43 49 42 47 43 44 Z';
// 마른 진흙처럼 갈라진 금. 가는 금은 굵은 금에서 갈라져 나옴
const CRACKS = [
  'M50 38 l3 5 l-1 5 l4 4 l-1 6',
  'M53 48 l6 -1 l4 3 l6 -2',
  'M63 33 l1 5 l5 3',
  'M44 55 l5 1 l2 5 l5 2',
  'M66 54 l-3 6 l3 5 l-1 6',
  'M75 52 l5 3 l1 5',
  'M56 62 l4 3 l-1 5',
  'M71 40 l3 4 l5 1',
];
const BLOTCHES: [number, number, number, number][] = [
  [62, 47, 6, 4],
  [47, 63, 4.5, 3],
  [76, 61, 5, 3.4],
];
const FLECKS: P[] = [[52, 42], [58, 55], [69, 48], [74, 57], [45, 50], [63, 66], [80, 50]];

// 공 겉의 삼각 격자. 세 방향 평행선이 겹쳐 지오데식 돔처럼 보임
const LATTICE = [-57, -38, -19, 0, 19, 38, 57];

const f = (value: number) => Math.round(value * 10) / 10;
const unit = ([x, y]: P): P => {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
};

// 모서리를 둥글린 다각형 (돌판 모서리가 닳은 느낌)
function rounded(points: P[], radius: number) {
  const cut = (from: P, to: P): P => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const k = Math.min(radius, Math.hypot(dx, dy) / 2) / (Math.hypot(dx, dy) || 1);
    return [from[0] + dx * k, from[1] + dy * k];
  };
  return (
    points
      .map((point, index) => {
        const a = cut(point, points[(index - 1 + points.length) % points.length]!);
        const b = cut(point, points[(index + 1) % points.length]!);
        return `${index ? 'L' : 'M'}${f(a[0])} ${f(a[1])} Q${f(point[0])} ${f(point[1])} ${f(b[0])} ${f(b[1])}`;
      })
      .join(' ') + ' Z'
  );
}

// 다리 한 마디: from 에서 to 까지 폭이 줄어드는 납작한 돌판. 윗면 가장자리는 밝게, 가운데에 금 하나
function slab(from: P, to: P, start: number, end: number) {
  const [dx, dy] = unit([to[0] - from[0], to[1] - from[1]]);
  const [nx, ny] = [-dy, dx];
  const side = (point: P, width: number, sign: number): P => [point[0] + nx * width * sign, point[1] + ny * width * sign];
  const outline = rounded([side(from, start / 2, 1), side(to, end / 2, 1), side(to, end / 2, -1), side(from, start / 2, -1)], 2.6);
  const edgeFrom = side(from, start / 2 - 1.4, -1);
  const edgeTo = side(to, end / 2 - 1.4, -1);
  const mid: P = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const crack = `M${f(mid[0] + nx * 2.4)} ${f(mid[1] + ny * 2.4)} l${f(dx * 1.6 - nx * 1.8)} ${f(dy * 1.6 - ny * 1.8)} l${f(-dx * 1.2 - nx * 1.8)} ${f(-dy * 1.2 - ny * 1.8)}`;
  return { outline, edge: `M${f(edgeFrom[0])} ${f(edgeFrom[1])} L${f(edgeTo[0])} ${f(edgeTo[1])}`, crack };
}

function LegShape({ leg }: { leg: Leg }) {
  const { hip, elbow, foot } = leg;
  const upper = slab(hip, elbow, 11, 9.5);
  const lower = slab(elbow, foot, 9, 6.5);
  // 관절은 두 마디 사이를 잇는 원통. 골(주름 고리)은 원통을 가로지름
  const up = unit([elbow[0] - hip[0], elbow[1] - hip[1]]);
  const [lx, ly] = unit([foot[0] - elbow[0], foot[1] - elbow[1]]);
  const along = unit([up[0] + lx, up[1] + ly]);
  const angle = f((Math.atan2(along[1], along[0]) * 180) / Math.PI);
  const shoulder = f((Math.atan2(up[1], up[0]) * 180) / Math.PI);
  // 손가락 세 개를 발끝에서 부채꼴로 폄
  const fingers = [-38, 0, 38]
    .map((turn) => {
      const radians = (turn * Math.PI) / 180;
      const x = lx * Math.cos(radians) - ly * Math.sin(radians);
      const y = lx * Math.sin(radians) + ly * Math.cos(radians);
      return `M${foot[0]} ${foot[1]} l${f(x * 4.6)} ${f(y * 4.6)}`;
    })
    .join(' ');
  return (
    <g className={`rocky-leg is-${leg.group}${leg.bump ? ' is-bump' : ''}`} style={{ transformOrigin: `${hip[0]}px ${hip[1]}px` }}>
      <path className="rocky-slab" d={upper.outline} />
      <path className="rocky-slab-edge" d={upper.edge} />
      <path className="rocky-slab-crack" d={upper.crack} />
      <path className="rocky-slab" d={lower.outline} />
      <path className="rocky-slab-edge" d={lower.edge} />
      <path className="rocky-fingers" d={fingers} />
      {/* 어깨: 몸에 붙는 자리에도 작은 주름 고리 */}
      <g transform={`translate(${f(hip[0] + up[0] * 3)} ${f(hip[1] + up[1] * 3)}) rotate(${shoulder})`}>
        <rect className="rocky-joint" x="-3" y="-5" width="6" height="10" rx="2.6" />
        <path className="rocky-joint-ridge" d="M-0.8 -4.6 v9.2 M1.4 -4.4 v8.8" />
      </g>
      <g transform={`translate(${elbow[0]} ${elbow[1]}) rotate(${angle})`}>
        <rect className="rocky-joint" x="-4.6" y="-4.4" width="9.2" height="8.8" rx="3" />
        <path className="rocky-joint-ridge" d="M-2.6 -4 v8 M-0.4 -4.3 v8.6 M1.8 -4 v8" />
      </g>
    </g>
  );
}

export function RockyArt() {
  const id = useId();
  const clip = `${id}-ball`;
  const glass = `${id}-glass`;
  const stone = `${id}-stone`;
  return (
    <svg className="rocky-art" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="60" cy="60" r="56" />
        </clipPath>
        {/* 공 가장자리로 갈수록 초록빛이 짙어져 둥근 유리처럼 보임 */}
        <radialGradient id={glass} cx="44%" cy="38%" r="66%">
          <stop offset="0.55" className="rocky-glass-core" />
          <stop offset="1" className="rocky-glass-rim" />
        </radialGradient>
        {/* 몸은 왼쪽 위에서 빛을 받아 오른쪽 아래가 어두움 */}
        <radialGradient id={stone} cx="38%" cy="30%" r="78%">
          <stop offset="0" className="rocky-stone-light" />
          <stop offset="0.5" className="rocky-stone-mid" />
          <stop offset="1" className="rocky-stone-dark" />
        </radialGradient>
      </defs>
      <circle className="rocky-glass" cx="60" cy="60" r="57" fill={`url(#${glass})`} />
      {/* 공 겉의 지오데식 결. 공이 굴러간 만큼 돌아감 */}
      <g clipPath={`url(#${clip})`}>
        <g className="rocky-geo">
          {[0, 60, -60].map((turn) => (
            <g key={turn} transform={`rotate(${turn} 60 60)`}>
              {LATTICE.map((offset) => (
                <line key={offset} x1="0" x2="120" y1={60 + offset} y2={60 + offset} />
              ))}
            </g>
          ))}
        </g>
      </g>
      <ellipse className="rocky-ground" cx="60" cy="101" rx="36" ry="6" />
      {/* creature 는 가는 쪽으로 좌우 뒤집기, motion 은 폴짝, 어지러움, 같이 구르기 (transform 이 겹치지 않게 나눔)
          버둥거리거나 주먹을 들어도 공 안쪽 벽까지만 보이게 공 모양으로 자름 */}
      {/* 몸과 다리 돌판이 같은 명암(stone)을 쓰도록 CSS 변수로 넘김 */}
      <g className="rocky-creature" clipPath={`url(#${clip})`} style={{ ['--rocky-stone' as string]: `url(#${stone})` }}>
        <g className="rocky-motion">
          {BACK_LEGS.map((leg) => (
            <g key={leg.hip.join()} className="rocky-back">
              <LegShape leg={leg} />
            </g>
          ))}
          <g className="rocky-torso">
            <path className="rocky-body" d={BODY} />
            <path className="rocky-underside" d={UNDERSIDE} />
            {BLOTCHES.map(([cx, cy, rx, ry]) => (
              <ellipse key={`${cx}-${cy}`} className="rocky-blotch" cx={cx} cy={cy} rx={rx} ry={ry} />
            ))}
            <path className="rocky-plate" d={PLATE} />
            <path className="rocky-highlight" d={HIGHLIGHT} />
            {CRACKS.map((crack) => (
              <path key={crack} className="rocky-crack" d={crack} />
            ))}
            {FLECKS.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} className="rocky-fleck" cx={cx} cy={cy} r="0.9" />
            ))}
          </g>
          {FRONT_LEGS.map((leg) => (
            <LegShape key={leg.hip.join()} leg={leg} />
          ))}
        </g>
      </g>
      <circle className="rocky-rim" cx="60" cy="60" r="55.5" />
      <path className="rocky-shine" d="M21 40 A42 42 0 0 1 40 17" />
      <circle className="rocky-shine-dot" cx="47" cy="13.5" r="1.8" />
      <path className="rocky-shine-low" d="M92 88 A40 40 0 0 1 80 99" />
    </svg>
  );
}
