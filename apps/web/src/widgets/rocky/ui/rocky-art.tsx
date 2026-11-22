import { useId } from 'react';

// 제노나이트 공 바닥에 선 로키를 비스듬히 앞에서 본 모습. 소설 묘사와 영화 스틸의 특징(금 간 황토빛 바윗덩이 몸,
// 돌판 두 마디 다리, 주름진 관절, 세 손가락)을 참고해 이 사이트 톤으로 직접 단순하게 그림. 공식 그림은 쓰지 않음

interface Leg {
  hip: [number, number];
  elbow: [number, number];
  foot: [number, number];
  /** 걸을 때 번갈아 딛는 두 무리 */
  group: 'a' | 'b';
  /** 주먹 맞대기 때 드는 앞다리 */
  bump?: boolean;
}

// 뒤 다리 둘은 몸 뒤에, 옆 다리 둘과 앞 다리 하나는 몸 앞에 그림
const BACK_LEGS: Leg[] = [
  { hip: [47, 50], elbow: [27, 50], foot: [35, 86], group: 'b' },
  { hip: [73, 50], elbow: [93, 50], foot: [85, 86], group: 'a' },
];
const FRONT_LEGS: Leg[] = [
  { hip: [43, 66], elbow: [19, 70], foot: [24, 99], group: 'a' },
  { hip: [77, 66], elbow: [101, 70], foot: [96, 99], group: 'b', bump: true },
  { hip: [57, 74], elbow: [49, 89], foot: [57, 105], group: 'b' },
];

const BODY = 'M38 64 C33 52 39 40 50 36 C56 32 66 32 72 36 C83 40 88 52 83 64 C80 72 70 77 60 77 C49 77 41 72 38 64 Z';
const PLATE = 'M68 37 C77 35 86 41 87 51 C82 48 75 46 68 46 C66 43 66 40 68 37 Z';
const HIGHLIGHT = 'M45 43 C49 38 57 36 61 39 C56 41 50 44 46 49 C44 47 44 45 45 43 Z';
const CRACKS = ['M53 41 l4 6 l-2 5 l5 4', 'M71 49 l-3 7 l4 3', 'M46 59 l6 2 l3 6', 'M64 63 l3 5'];

function LegShape({ leg }: { leg: Leg }) {
  const [hx, hy] = leg.hip;
  const [ex, ey] = leg.elbow;
  const [fx, fy] = leg.foot;
  const path = `M${hx} ${hy} L${ex} ${ey} L${fx} ${fy}`;
  // 관절 고리는 위 마디 방향으로 눕힘
  const angle = (Math.atan2(ey - hy, ex - hx) * 180) / Math.PI;
  return (
    <g className={`rocky-leg is-${leg.group}${leg.bump ? ' is-bump' : ''}`} style={{ transformOrigin: `${hx}px ${hy}px` }}>
      <path className="rocky-leg-edge" d={path} />
      <path className="rocky-leg-stone" d={path} />
      <g transform={`rotate(${angle} ${ex} ${ey})`}>
        <ellipse className="rocky-joint" cx={ex} cy={ey} rx="4.6" ry="3.6" />
        <path className="rocky-joint-ridge" d={`M${ex - 1.6} ${ey - 3} v6 M${ex + 1.4} ${ey - 3} v6`} />
      </g>
      <path className="rocky-fingers" d={`M${fx} ${fy} l-4 3 M${fx} ${fy} l0.4 4.4 M${fx} ${fy} l4 3`} />
    </g>
  );
}

export function RockyArt() {
  const clip = useId();
  return (
    <svg className="rocky-art" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="60" cy="60" r="56" />
        </clipPath>
      </defs>
      <circle className="rocky-glass" cx="60" cy="60" r="57" />
      {/* 공 겉의 지오데식 결. 공이 굴러간 만큼 돌아감 */}
      <g clipPath={`url(#${clip})`}>
        <g className="rocky-geo">
          <ellipse cx="60" cy="60" rx="57" ry="17" />
          <ellipse cx="60" cy="60" rx="57" ry="17" transform="rotate(60 60 60)" />
          <ellipse cx="60" cy="60" rx="57" ry="17" transform="rotate(-60 60 60)" />
          <ellipse cx="60" cy="60" rx="17" ry="57" />
        </g>
      </g>
      <ellipse className="rocky-ground" cx="60" cy="101" rx="34" ry="6" />
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
            <path className="rocky-body" d={BODY} />
            <path className="rocky-plate" d={PLATE} />
            <path className="rocky-highlight" d={HIGHLIGHT} />
            {CRACKS.map((crack) => (
              <path key={crack} className="rocky-crack" d={crack} />
            ))}
          </g>
          {FRONT_LEGS.map((leg) => (
            <LegShape key={leg.hip.join()} leg={leg} />
          ))}
        </g>
      </g>
      <path className="rocky-shine" d="M21 40 A42 42 0 0 1 40 17" />
    </svg>
  );
}
