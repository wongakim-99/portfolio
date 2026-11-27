import { describe, expect, it } from 'vitest';
import type { BlogPostSummary } from '@entities/blog-post';
import { boardLayout, gapLabel, MAX_THREADS, threadsOf, trailLayout, yarnPath } from './board';

const post = (id: string, createdAt: string, tags: string[] = [], room: { id: string; name: string } | null = null): BlogPostSummary => ({
  id, title: id, visibility: 'public', locked: false, tags, cover: null, room, excerpt: '', readMinutes: 1, createdAt, updatedAt: createdAt,
});
const study = { id: 'r1', name: '공부방' };

describe('threadsOf', () => {
  it('같은 태그, 같은 방의 글을 오래된 것부터 실 하나로 꿰고, 글이 하나뿐인 묶음은 실을 걸지 않음', () => {
    const posts = [
      post('kafka', '2026-11-22T03:00:00Z', ['공부 노트', 'Kafka'], study),
      post('rbac', '2026-11-22T02:00:00Z', ['공부 노트', '보안'], study),
      post('auth', '2026-11-22T01:00:00Z', ['공부 노트', '보안'], study),
      post('diary', '2026-11-24T01:00:00Z', ['잡담']),
    ];
    const threads = threadsOf(posts);
    // 공부방과 #공부 노트는 꿰는 글이 같아 한 가닥으로 합침
    expect(threads.map((thread) => [thread.label, thread.posts])).toEqual([
      ['공부방 #공부 노트', ['auth', 'rbac', 'kafka']],
      ['#보안', ['auth', 'rbac']],
    ]);
    expect(threads.map((thread) => [thread.kind, thread.color])).toEqual([['room', 1], ['tag', 2]]);
  });

  it('대소문자만 다른 태그는 같은 실이고, 실은 많아도 MAX_THREADS 개까지', () => {
    expect(threadsOf([post('a', '1', ['Kafka']), post('b', '2', ['kafka'])])[0]!.posts).toEqual(['a', 'b']);
    const many = Array.from({ length: 12 }, (_, i) => [post(`x${i}`, `${i}a`, [`t${i}`]), post(`y${i}`, `${i}b`, [`t${i}`])]).flat();
    expect(threadsOf(many)).toHaveLength(MAX_THREADS);
  });
});

describe('boardLayout', () => {
  const posts = Array.from({ length: 7 }, (_, i) => post(`p${i}`, `2026-11-2${i}`, [], i < 3 ? study : null));

  it('카드가 판 안에 들고 서로 겹치지 않으며, 같은 글은 늘 같은 자리', () => {
    for (const width of [320, 390, 920]) {
      const layout = boardLayout(posts, width);
      const slots = [...layout.slots.values()];
      for (const slot of slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x + layout.cardWidth).toBeLessThanOrEqual(width);
        expect(slot.y + layout.cardHeight).toBeLessThanOrEqual(layout.height);
        expect(Math.abs(slot.tilt)).toBeLessThanOrEqual(3.5);
      }
      slots.forEach((a, i) => slots.slice(i + 1).forEach((b) => {
        const apart = Math.abs(a.x - b.x) >= layout.cardWidth || Math.abs(a.y - b.y) >= layout.cardHeight;
        expect(apart).toBe(true);
      }));
      expect(boardLayout(posts, width).slots).toEqual(layout.slots);
    }
  });

  it('글이 많은 방의 글부터 앞줄에 모음', () => {
    const mixed = [post('solo', '2026-11-29', [], { id: 'r2', name: '잡담방' }), ...posts];
    const layout = boardLayout(mixed, 920);
    const firstRow = [...layout.slots.entries()].filter(([, slot]) => slot.y < 130).map(([id]) => id);
    expect(firstRow.sort()).toEqual(['p0', 'p1', 'p2']);
  });
});

describe('yarnPath', () => {
  const controlY = (d: string) => Number(d.split('Q')[1]!.split(' ')[1]);

  it('같은 줄의 카드끼리는 위로 둥글게, 줄이 다르면 아래로 처지게 걺', () => {
    const same = yarnPath({ x: 0, y: 100 }, { x: 200, y: 110 }, 1);
    expect(same.startsWith('M0.0 100.0 Q100.0')).toBe(true);
    expect(controlY(same)).toBeLessThan(100);
    expect(controlY(yarnPath({ x: 0, y: 100 }, { x: 200, y: 330 }, 1))).toBeGreaterThan(330);
  });

  it('위로 걸어도 곡선 꼭대기가 판 위 끝을 넘지 않음', () => {
    const d = yarnPath({ x: 0, y: 40 }, { x: 600, y: 40 }, 4);
    expect((40 + 2 * controlY(d) + 40) / 4).toBeGreaterThanOrEqual(6);
  });
});

describe('trailLayout', () => {
  it('카드를 위에서 아래로 겹치지 않게 꽂고, 왼쪽 여백은 실 자리로 비워 둠', () => {
    const layout = trailLayout(['a', 'b', 'c'], 342);
    layout.slots.forEach((slot, i) => {
      expect(slot.x).toBeGreaterThanOrEqual(34);
      expect(slot.x + layout.cardWidth).toBeLessThanOrEqual(342);
      if (i) expect(slot.y - layout.slots[i - 1]!.y).toBe(layout.cardHeight + layout.gap);
    });
    expect(layout.height).toBeGreaterThan(layout.slots[2]!.y + layout.cardHeight);
  });
});

describe('gapLabel', () => {
  it('서울 날짜로 며칠, 몇 달, 몇 년 뒤인지 적음', () => {
    // 서울 기준 같은 날 (UTC 로는 하루가 넘어감)
    expect(gapLabel('2026-11-21T15:30:00Z', '2026-11-22T14:00:00Z')).toBe('같은 날');
    expect(gapLabel('2026-11-21T01:00:00Z', '2026-11-23T01:00:00Z')).toBe('2일 뒤');
    expect(gapLabel('2026-01-01T01:00:00Z', '2026-04-01T01:00:00Z')).toBe('3달 뒤');
    expect(gapLabel('2024-11-01T01:00:00Z', '2026-11-01T01:00:00Z')).toBe('2년 뒤');
  });
});
