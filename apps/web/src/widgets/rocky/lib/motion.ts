// 로키 공의 움직임 계산. 화면(DOM)을 모르는 순수 함수만 둠

export interface Point {
  x: number;
  y: number;
}

/** from 에서 to 쪽으로 최대 step 만큼 나아간 점과 다 왔는지 */
export function stepToward(from: Point, to: Point, step: number): { point: Point; arrived: boolean } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= step) return { point: { ...to }, arrived: true };
  return { point: { x: from.x + (dx / distance) * step, y: from.y + (dy / distance) * step }, arrived: false };
}

/** 가운데와 그 둘레 count 개의 점. 공이 놓일 자리가 비었는지 볼 때 씀 */
export function ringPoints(center: Point, radius: number, count: number): Point[] {
  return [
    center,
    ...Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    }),
  ];
}

/** 빈 자리 후보 가운데 지금 자리에서 너무 가깝지도 멀지도 않은 곳. 없으면 가장 가까운 곳 */
export function pickWanderSpot(spots: readonly Point[], from: Point | null, near = 60, far = 340): Point | null {
  if (!spots.length) return null;
  if (!from) return spots[0]!;
  const byDistance = [...spots].sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y));
  const comfortable = byDistance.filter((spot) => {
    const distance = Math.hypot(spot.x - from.x, spot.y - from.y);
    return distance >= near && distance <= far;
  });
  return comfortable[0] ?? byDistance[0]!;
}
