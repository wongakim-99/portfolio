'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { cx } from '@shared/lib';
import type { BlogPostSummary } from '@entities/blog-post';
import { gapLabel, labelWidth, trailLayout, type Thread } from '../lib/board';
import { BoardCard } from './board-card';

// 휴대폰의 코르크판. 판 전체를 한꺼번에 줄여 보이는 대신, 위에서 사건 파일(실)을 하나 골라 그 실을 따라 내려감
// 고른 실에 꿰인 글이 오래된 것부터 한 줄로 꽂히고, 털실은 왼쪽 여백을 따라 내려가며 카드 압정에 걸림
// 카드 사이 실에는 두 글이 얼마나 떨어져 쓰였는지(2일 뒤) 꼬리표가 달림. 마우스 올림이 없어도 실이 무엇을 잇는지 보임

const LOOSE = 'loose';

interface Tab {
  id: string;
  label: string;
  /** 털실 색. 따로 꽂힌 글은 0(실 없음) */
  color: number;
  /** 꿴 글, 오래된 것부터 */
  ids: string[];
}

// 카드 왼쪽 위 압정 자리. 실이 카드 글씨에 닿지 않게 카드 안쪽 여백(14px)보다 왼쪽
const pinOf = (slot: { x: number; y: number }) => ({ x: slot.x + 9, y: slot.y + 14 });

// 위 압정에서 아래 압정으로 내려가는 실. 왼쪽 여백 쪽으로 불룩하게 휘어 카드 위를 지나지 않음
const dropPath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const dy = to.y - from.y;
  return `M${from.x} ${from.y} C${from.x - 18} ${from.y + dy * 0.4} ${to.x - 18} ${to.y - dy * 0.4} ${to.x} ${to.y}`;
};

export function ThreadTrail({ posts, threads, width }: { posts: BlogPostSummary[]; threads: Thread[]; width: number }) {
  const [picked, setPicked] = useState<string | null>(null);
  const byId = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const tabs = useMemo<Tab[]>(() => {
    const threaded = new Set(threads.flatMap((thread) => thread.posts));
    const loose = posts.filter((post) => !threaded.has(post.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return [
      ...threads.map((thread) => ({ id: thread.id, label: thread.label, color: thread.color, ids: thread.posts })),
      ...(loose.length ? [{ id: LOOSE, label: '따로 꽂힌 글', color: 0, ids: loose.map((post) => post.id) }] : []),
    ];
  }, [posts, threads]);
  const tab = tabs.find((item) => item.id === picked) ?? tabs[0];
  if (!tab) return null;

  const layout = trailLayout(tab.ids, width);
  const strung = tab.color > 0;
  const pins = layout.slots.map(pinOf);
  const last = pins[pins.length - 1]!;

  return (
    <div className="trail">
      <div className="trail-tabs" role="tablist" aria-label="따라갈 실 고르기">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === tab.id}
            className={cx('trail-tab', item.color ? `yarn-${item.color}` : 'is-loose', item.id === tab.id && 'is-active')}
            onClick={() => setPicked(item.id)}
          >
            <span className="thread-swatch" aria-hidden="true" />
            {item.label}
            <small>{item.ids.length}편</small>
          </button>
        ))}
      </div>
      {/* 실을 바꾸면 카드를 다시 꽂고 실을 다시 그음 */}
      <div key={tab.id} className="trail-strip" role="tabpanel" aria-label={tab.label} style={{ height: layout.height }}>
        <ul className="thread-board-cards">
          {tab.ids.map((id, i) => {
            const post = byId.get(id);
            const slot = layout.slots[i]!;
            if (!post) return null;
            const style = {
              left: slot.x,
              top: slot.y,
              width: layout.cardWidth,
              height: layout.cardHeight,
              '--tilt': `${slot.tilt}deg`,
              '--delay': `${i * 90}ms`,
            } as CSSProperties;
            return (
              <li key={id} className="thread-card" style={style}>
                <BoardCard post={post} threads={threads.filter((thread) => thread.posts.includes(id))} />
              </li>
            );
          })}
        </ul>
        <svg className="thread-board-yarn" viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height} aria-hidden="true">
          {strung && (
            <g className={`yarn-${tab.color}`}>
              {pins.slice(1).map((to, i) => (
                <path key={i} className="yarn" style={{ '--delay': `${250 + i * 160}ms` } as CSSProperties} d={dropPath(pins[i]!, to)} pathLength={1} />
              ))}
              {/* 마지막 압정에서 아래로 늘어진 실 끝 */}
              <path
                className="yarn"
                style={{ '--delay': `${250 + (pins.length - 1) * 160}ms` } as CSSProperties}
                d={`M${last.x} ${last.y} C${last.x - 20} ${last.y + 60} ${last.x + 6} ${last.y + layout.cardHeight + 10} ${last.x - 10} ${last.y + layout.cardHeight + 34}`}
                pathLength={1}
              />
              {pins.slice(1).map((to, i) => {
                const text = gapLabel(byId.get(tab.ids[i]!)!.createdAt, byId.get(tab.ids[i + 1]!)!.createdAt);
                const w = labelWidth(text);
                // 두 카드 사이 틈, 실 오른쪽에 매단 쪽지
                const y = layout.slots[i]!.y + layout.cardHeight + layout.gap / 2;
                return (
                  <g key={`gap-${i}`} className="yarn-label trail-gap" transform={`translate(${Math.min(pins[i]!.x, to.x) + 4} ${y - 11})`}>
                    <rect width={w} height={22} rx={3} />
                    <text x={w / 2} y={15}>
                      {text}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          {pins.map((pin, i) => (
            <g key={tab.ids[i]} className={cx('pin', strung ? `yarn-${tab.color}` : 'is-plain')}>
              <circle cx={pin.x} cy={pin.y} r={6.5} />
              <circle className="pin-shine" cx={pin.x - 2} cy={pin.y - 2} r={2} />
            </g>
          ))}
        </svg>
        {strung && (
          <p className="hand trail-end" style={{ top: last.y + layout.cardHeight + 30, left: last.x + 2 }}>
            아직 이어지는 중...
          </p>
        )}
      </div>
    </div>
  );
}
