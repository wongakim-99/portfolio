import { describe, expect, it } from 'vitest';
import { pickWanderSpot, ringPoints, stepToward } from './motion';
import { BUMP_LINE, chordsFor, DIZZY_LINES, ROCKY_LINES } from './voice';

describe('로키 공 움직임', () => {
  it('목표 쪽으로 한 걸음씩 가다가 가까우면 도착함', () => {
    expect(stepToward({ x: 0, y: 0 }, { x: 30, y: 40 }, 10)).toEqual({ point: { x: 6, y: 8 }, arrived: false });
    expect(stepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)).toEqual({ point: { x: 3, y: 4 }, arrived: true });
  });

  it('빈 자리를 볼 때 가운데와 둘레 점을 고르게 찍음', () => {
    const points = ringPoints({ x: 100, y: 100 }, 10, 4);
    expect(points).toHaveLength(5);
    expect(points[1]!.x).toBeCloseTo(110);
    expect(points[2]!.y).toBeCloseTo(110);
  });

  it('너무 가깝거나 먼 곳은 피하고, 맞는 곳이 없으면 가장 가까운 곳으로 감', () => {
    const from = { x: 0, y: 0 };
    expect(pickWanderSpot([{ x: 10, y: 0 }, { x: 200, y: 0 }, { x: 900, y: 0 }], from)).toEqual({ x: 200, y: 0 });
    expect(pickWanderSpot([{ x: 900, y: 0 }, { x: 10, y: 0 }], from)).toEqual({ x: 10, y: 0 });
    expect(pickWanderSpot([], from)).toBeNull();
  });
});

describe('로키 목소리', () => {
  it('대사마다 2~4개의 세 음 화음을 늘 같게 만듦', () => {
    for (const line of [...ROCKY_LINES, BUMP_LINE, ...DIZZY_LINES]) {
      const chords = chordsFor(line);
      expect(chords.length).toBeGreaterThanOrEqual(2);
      expect(chords.length).toBeLessThanOrEqual(4);
      for (const chord of chords) expect(chord).toHaveLength(3);
      expect(chordsFor(line)).toEqual(chords);
    }
  });
});
