import { useId } from 'react';

// 제노나이트 공 바닥에 선 로키를 비스듬히 앞에서 본 모습. 소설 묘사(오각형 등딱지, 두께는 폭의 절반, 다리 다섯, 손가락 셋, 얼굴 없음)와
// 영화 속 인형의 특징(모래빛 사암을 깎은 듯 면이 진 몸, 굵고 각진 돌기둥 다리, 다리에 새긴 문양, 큰 삼각형 지오데식 공)을 참고해 이 사이트 톤으로 직접 그림. 공식 그림은 쓰지 않음

type P = readonly [number, number];

/** 다리에 새긴 문양. 영화 속 로키 다리의 자 눈금, 결혼 표시 고리, 작은 흉터 점 */
type Mark = 'ruler' | 'rings' | 'dots';

interface Leg {
  hip: P;
  knee: P;
  foot: P;
  /** 걸을 때 번갈아 딛는 두 무리 */
  group: 'a' | 'b';
  /** 주먹 맞대기 때 드는 앞다리 */
  bump?: boolean;
  mark?: Mark;
}

// 뒤 다리 둘은 몸 뒤에, 옆 다리 둘과 앞 다리 하나는 몸 앞에 그림. 무릎이 몸보다 높이 솟는 거미 같은 자세
const BACK_LEGS: Leg[] = [
  { hip: [46, 41], knee: [30, 31], foot: [24, 84], group: 'b' },
  { hip: [74, 41], knee: [90, 31], foot: [96, 84], group: 'a', mark: 'dots' },
];
const FRONT_LEGS: Leg[] = [
  { hip: [42, 55], knee: [23, 46], foot: [17, 89], group: 'a', mark: 'ruler' },
  { hip: [78, 55], knee: [97, 46], foot: [103, 89], group: 'b', bump: true, mark: 'rings' },
  { hip: [60, 68], knee: [50, 83], foot: [57, 104], group: 'b' },
];

// 몸: 오각형 등딱지를 위에서 비스듬히 봄. 뒤 꼭짓점은 닳아서 윗면이 평평한 덩어리. 윗면(밝음), 앞면(가운데 톤), 양옆(어두움), 밑(그늘)으로 깎인 사암 덩어리
const TOP: P[] = [[38.5, 38.5], [50, 32], [66, 31], [81.5, 37], [78.5, 47.5], [43, 48.5]];
const FRONT: P[] = [[43, 48.5], [78.5, 47.5], [74.5, 66], [61, 71.5], [47, 67.5]];
const LEFT: P[] = [[38.5, 38.5], [43, 48.5], [47, 67.5], [38, 58.5]];
const RIGHT: P[] = [[81.5, 37], [78.5, 47.5], [74.5, 66], [82.5, 57]];
const OUTLINE: P[] = [[38.5, 38.5], [50, 32], [66, 31], [81.5, 37], [82.5, 57], [74.5, 66], [61, 71.5], [47, 67.5], [38, 58.5]];
// 밑으로 말려 들어가는 그늘. 몸 아래 가장자리를 따라 안쪽에 띠로 둠
const UNDERSIDE: P[] = [[38, 58.5], [47, 67.5], [61, 71.5], [74.5, 66], [82.5, 57], [80.8, 55.8], [73.4, 63.4], [61, 68.6], [48.2, 64.8], [39.6, 57.2]];
// 끌로 쪼아 낸 작은 면들. 앞면의 밝은 조각과 어두운 조각, 윗면의 패인 자리
const CHIPS: { points: P[]; tone: 'light' | 'dark' }[] = [
  { points: [[44.5, 49.5], [57, 49], [51.5, 59.5]], tone: 'light' },
  { points: [[64, 58], [76, 50], [72.5, 64.5]], tone: 'dark' },
  { points: [[52, 34.5], [63, 33], [59.5, 40]], tone: 'dark' },
  { points: [[66, 41], [77, 39.5], [74, 45.5]], tone: 'light' },
  { points: [[40, 45], [43.5, 51], [41.5, 55.5]], tone: 'light' },
];
// 면과 면이 만나는 모서리. 진하게 그리지 않고 살짝만
const CREASES = ['M43 48.5 L78.5 47.5', 'M58 31.5 L60.5 47.9', 'M60.5 48 L58.5 59 L61 71.5', 'M43 48.5 L47 67.5', 'M78.5 47.5 L74.5 66', 'M38.5 38.5 L49 43 L60.5 48'];
// 사암의 갈색 점과 패인 구멍
const SPECKS: [number, number, number][] = [
  [48, 40, 0.9], [55, 44, 0.5], [67, 35, 0.7], [73, 43, 1.1], [64, 45, 0.5], [47, 57, 0.6], [53, 64, 0.9],
  [63, 62, 0.5], [67, 53, 0.8], [75, 58, 0.6], [41, 50, 0.5], [79, 51, 0.7], [58, 55, 1], [70, 39, 0.4],
  [44, 43, 0.5], [62, 67, 0.7], [51, 52, 0.4],
];

const f = (value: number) => Math.round(value * 10) / 10;
const path = (points: readonly P[]) => `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;
const unit = ([x, y]: P): P => {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
};
const along = (from: P, to: P, t: number): P => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];

// 모서리를 살짝 둥글린 다각형 (깎은 돌 모서리가 닳은 느낌)
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

// 다리 한 마디: from 에서 to 까지 폭이 줄어드는 각진 돌기둥. 위를 보는 면은 밝게, 아래 모서리는 어둡게 해서 네모난 기둥처럼 보임
function pillar(from: P, to: P, start: number, end: number) {
  const [dx, dy] = unit([to[0] - from[0], to[1] - from[1]]);
  // 빛은 왼쪽 위에서 오므로 위쪽(곧은 기둥은 왼쪽)을 향하는 옆면을 밝은 면으로 고름
  const [nx, ny]: P = dx > 0 ? [dy, -dx] : dx < 0 ? [-dy, dx] : [-1, 0];
  const side = (point: P, width: number): P => [point[0] + nx * width, point[1] + ny * width];
  // 양끝은 비스듬히 깎아서 마디끼리 맞물린 돌처럼 보임
  const a = along(from, to, 0.08);
  const b = along(from, to, 0.92);
  return {
    outline: rounded([side(from, start / 2), side(to, end / 2), side(to, -end / 2), side(from, -start / 2)], 1.4),
    light: path([side(a, start / 2 - 0.9), side(b, end / 2 - 0.9), side(b, end * 0.04), side(a, start * 0.04)]),
    shade: path([side(a, -start / 2 + 0.7), side(b, -end / 2 + 0.7), side(b, -end * 0.3), side(a, -start * 0.3)]),
    normal: [nx, ny] as P,
  };
}

// 관절: 두 마디가 맞물리는 자리의 각진 마디돌(육각형). 윗면은 밝게, 가운데에 주름 하나
function knuckle(center: P, radius: number, turn: number) {
  const points = Array.from({ length: 6 }, (_, index): P => {
    const angle = ((turn + index * 60) * Math.PI) / 180;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius * 0.86];
  });
  const [x, y] = center;
  return {
    outline: rounded(points, 1.1),
    light: path([points[3]!, points[4]!, points[5]!, [x, y]]),
    crease: `M${f(points[1]![0])} ${f(points[1]![1])} L${f(x)} ${f(y)} L${f(points[4]![0])} ${f(points[4]![1])}`,
  };
}

// 다리에 새긴 문양. 위 마디 가운데쯤, 밝은 면 쪽에 가늘게 팜
function markPath(mark: Mark, from: P, to: P, normal: P) {
  const [dx, dy] = unit([to[0] - from[0], to[1] - from[1]]);
  const [nx, ny] = normal;
  if (mark === 'ruler') {
    return [0.3, 0.42, 0.54, 0.66, 0.78]
      .map((t, index) => {
        const [x, y] = along(from, to, t);
        const length = index % 2 ? 1.4 : 2.4;
        return `M${f(x + nx * 0.6)} ${f(y + ny * 0.6)} l${f(nx * length)} ${f(ny * length)}`;
      })
      .join(' ');
  }
  const [cx, cy] = along(from, to, 0.55);
  if (mark === 'rings') {
    const ring = (x: number, y: number) => `M${f(x + 1.5)} ${f(y)} a1.5 1.5 0 1 0 -3 0 a1.5 1.5 0 1 0 3 0`;
    return ring(cx + nx * 1.4 - dx * 1, cy + ny * 1.4 - dy * 1) + ring(cx + nx * 1.4 + dx * 1, cy + ny * 1.4 + dy * 1);
  }
  return [-2, 0, 2]
    .map((step) => `M${f(cx + nx * 1.5 + dx * step)} ${f(cy + ny * 1.5 + dy * step)} h0.01`)
    .join(' ');
}

function LegShape({ leg }: { leg: Leg }) {
  const { hip, knee, foot } = leg;
  const upper = pillar(hip, knee, 12, 10.5);
  const lower = pillar(knee, foot, 10, 7.5);
  const [ux, uy] = unit([knee[0] - hip[0], knee[1] - hip[1]]);
  const [lx, ly] = unit([foot[0] - knee[0], foot[1] - knee[1]]);
  const bend = (Math.atan2(uy + ly, ux + lx) * 180) / Math.PI;
  const elbow = knuckle(knee, 6.2, bend);
  const shoulder = knuckle([hip[0] + ux * 2.5, hip[1] + uy * 2.5], 5.2, (Math.atan2(uy, ux) * 180) / Math.PI);
  // 손가락 세 개: 발끝에서 부채꼴로 편 굵고 뭉툭한 돌 손가락
  const fingers = [-48, 0, 48].map((turn) => {
    const radians = (turn * Math.PI) / 180;
    const x = lx * Math.cos(radians) - ly * Math.sin(radians);
    const y = lx * Math.sin(radians) + ly * Math.cos(radians);
    const base = 1.8;
    return rounded([
      [foot[0] - y * base - x * 1.5, foot[1] + x * base - y * 1.5],
      [foot[0] + x * 5.2 - y * 0.6, foot[1] + y * 5.2 + x * 0.6],
      [foot[0] + x * 5.5 + y * 0.4, foot[1] + y * 5.5 - x * 0.4],
      [foot[0] + y * base - x * 1.5, foot[1] - x * base - y * 1.5],
    ], 0.9);
  });
  // 돌기둥에도 몸과 같은 갈색 점
  const specks = [
    [hip, knee, 0.35, 1.6, 0.6], [hip, knee, 0.7, -2, 0.8], [knee, foot, 0.3, 1.2, 0.5], [knee, foot, 0.62, -1.4, 0.7], [knee, foot, 0.85, 0.8, 0.45],
  ].map(([from, to, t, offset, r]) => {
    const [x, y] = along(from as P, to as P, t as number);
    const [nx, ny] = from === hip ? upper.normal : lower.normal;
    return [f(x + nx * (offset as number)), f(y + ny * (offset as number)), r as number] as const;
  });
  return (
    <g className={`rocky-leg is-${leg.group}${leg.bump ? ' is-bump' : ''}`} style={{ transformOrigin: `${hip[0]}px ${hip[1]}px` }}>
      {[lower, upper].map((part) => (
        <g key={part.outline}>
          <path className="rocky-pillar" d={part.outline} />
          <path className="rocky-pillar-light" d={part.light} />
          <path className="rocky-pillar-shade" d={part.shade} />
          <path className="rocky-pillar-edge" d={part.outline} />
        </g>
      ))}
      {fingers.map((finger) => (
        <path key={finger} className="rocky-finger" d={finger} />
      ))}
      {specks.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} className="rocky-speck" cx={x} cy={y} r={r} />
      ))}
      {leg.mark && <path className={`rocky-mark is-${leg.mark}`} d={markPath(leg.mark, hip, knee, upper.normal)} />}
      {[shoulder, elbow].map((joint) => (
        <g key={joint.outline}>
          <path className="rocky-knuckle" d={joint.outline} />
          <path className="rocky-knuckle-light" d={joint.light} />
          <path className="rocky-knuckle-crease" d={joint.crease} />
        </g>
      ))}
    </g>
  );
}

// 공: 정이십면체의 면을 넷씩 나눈 지오데식 구(면 80개)를 비스듬히 돌려 정면에서 봄. 영화 속 공처럼 큰 삼각형 테
// 앞쪽 테는 로키 앞에, 뒤쪽 테는 로키 뒤에 그려서 투명한 공 안에 든 것처럼 보임
function geodesic(radius: number, center: number) {
  const g = (1 + Math.sqrt(5)) / 2;
  const normalize = ([x, y, z]: number[]) => {
    const length = Math.hypot(x!, y!, z!);
    return [x! / length, y! / length, z! / length];
  };
  const vertices = [
    [-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g],
    [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1],
  ].map(normalize);
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const middles = new Map<string, number>();
  const middle = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!middles.has(key)) {
      middles.set(key, vertices.length);
      vertices.push(normalize(vertices[a]!.map((value, axis) => value + vertices[b]![axis]!)));
    }
    return middles.get(key)!;
  };
  const edges = new Set<string>();
  for (const [a, b, c] of faces) {
    const [ab, bc, ca] = [middle(a!, b!), middle(b!, c!), middle(c!, a!)];
    for (const [p, q] of [[a, ab], [ab, b], [b, bc], [bc, c], [c, ca], [ca, a], [ab, bc], [bc, ca], [ca, ab]]) {
      edges.add(p! < q! ? `${p}-${q}` : `${q}-${p}`);
    }
  }
  // y 축으로 18도, x 축으로 -20도 돌려 오각형 꼭짓점이 정면에서 조금 비껴 보이게 함
  const [cy, sy, cx, sx] = [Math.cos(0.314), Math.sin(0.314), Math.cos(-0.349), Math.sin(-0.349)];
  const projected = vertices.map(([x, y, z]) => {
    const [x1, z1] = [cy * x! + sy * z!, -sy * x! + cy * z!];
    const [y2, z2] = [cx * y! - sx * z1, sx * y! + cx * z1];
    return [center + x1 * radius, center - y2 * radius, z2];
  });
  let front = '';
  let back = '';
  for (const edge of edges) {
    const [a, b] = edge.split('-').map((index) => projected[Number(index)]!);
    const segment = `M${f(a![0]!)} ${f(a![1]!)}L${f(b![0]!)} ${f(b![1]!)}`;
    if (a![2]! + b![2]! >= 0) front += segment;
    else back += segment;
  }
  return { front, back };
}
const GEO = geodesic(56, 60);

export function RockyArt() {
  const id = useId();
  const clip = `${id}-ball`;
  const glass = `${id}-glass`;
  return (
    <svg className="rocky-art" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="60" cy="60" r="56" />
        </clipPath>
        {/* 공 가장자리로 갈수록 살짝 짙어져 둥근 유리처럼 보임 */}
        <radialGradient id={glass} cx="44%" cy="38%" r="66%">
          <stop offset="0.55" className="rocky-glass-core" />
          <stop offset="1" className="rocky-glass-rim" />
        </radialGradient>
      </defs>
      <circle className="rocky-glass" cx="60" cy="60" r="57" fill={`url(#${glass})`} />
      {/* 공 뒤쪽 테. 공이 굴러간 만큼 돌아감 */}
      <g clipPath={`url(#${clip})`}>
        <path className="rocky-geo is-back" d={GEO.back} />
      </g>
      <ellipse className="rocky-ground" cx="60" cy="100" rx="38" ry="6.5" />
      {/* creature 는 가는 쪽으로 좌우 뒤집기, motion 은 폴짝, 어지러움, 같이 구르기 (transform 이 겹치지 않게 나눔)
          버둥거리거나 주먹을 들어도 공 안쪽 벽까지만 보이게 공 모양으로 자름 */}
      <g className="rocky-creature" clipPath={`url(#${clip})`}>
        <g className="rocky-motion">
          {BACK_LEGS.map((leg) => (
            <g key={leg.hip.join()} className="rocky-back">
              <LegShape leg={leg} />
            </g>
          ))}
          <g className="rocky-torso">
            <path className="rocky-face is-front" d={path(FRONT)} />
            <path className="rocky-face is-side" d={path(LEFT)} />
            <path className="rocky-face is-side is-far" d={path(RIGHT)} />
            <path className="rocky-face is-top" d={path(TOP)} />
            <path className="rocky-underside" d={path(UNDERSIDE)} />
            {CHIPS.map(({ points, tone }) => (
              <path key={points.join()} className={`rocky-chip is-${tone}`} d={path(points)} />
            ))}
            {CREASES.map((crease) => (
              <path key={crease} className="rocky-crease" d={crease} />
            ))}
            {SPECKS.map(([cx, cy, r]) => (
              <circle key={`${cx}-${cy}`} className="rocky-speck" cx={cx} cy={cy} r={r} />
            ))}
            <path className="rocky-body-edge" d={rounded([...OUTLINE], 1.6)} />
          </g>
          {FRONT_LEGS.map((leg) => (
            <LegShape key={leg.hip.join()} leg={leg} />
          ))}
        </g>
      </g>
      {/* 공 앞쪽 테: 로키 앞을 지나는 유리 모서리 */}
      <g clipPath={`url(#${clip})`}>
        <path className="rocky-geo is-front" d={GEO.front} />
      </g>
      <circle className="rocky-rim" cx="60" cy="60" r="55.5" />
      <path className="rocky-shine" d="M21 40 A42 42 0 0 1 40 17" />
      <circle className="rocky-shine-dot" cx="47" cy="13.5" r="1.8" />
      <path className="rocky-shine-low" d="M92 88 A40 40 0 0 1 80 99" />
    </svg>
  );
}
