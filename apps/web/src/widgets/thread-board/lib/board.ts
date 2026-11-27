import { formatStamp } from '@shared/lib';
import type { BlogPostSummary } from '@entities/blog-post';

// 코르크판 보기의 계산. 같은 태그, 같은 방에 든 글을 실 하나로 꿰고, 카드를 꽂을 자리를 정함
// 자리는 글 ID 로 정한 흔들림이라 새로고침해도 같은 자리에 꽂힘

/** 털실 색 수 (tokens.css 의 --yarn-1..4) */
export const YARN_COLORS = 4;
/** 실이 너무 많으면 판이 어지러워서, 글을 많이 꿴 실부터 이만큼만 걺 */
export const MAX_THREADS = 8;

/** 같은 태그나 같은 방으로 이어진 글 묶음. 실 하나가 글을 오래된 것부터 꿰어 지나감 */
export interface Thread {
  id: string;
  kind: 'tag' | 'room';
  label: string;
  /** 꿴 글 ID, 오래된 것부터 */
  posts: string[];
  /** 털실 색 1..YARN_COLORS */
  color: number;
}

export function threadsOf(posts: BlogPostSummary[]): Thread[] {
  const groups = new Map<string, Omit<Thread, 'color'>>();
  const oldestFirst = [...posts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const post of oldestFirst) {
    const keys: Omit<Thread, 'color' | 'posts'>[] = [
      ...(post.room ? [{ id: `room:${post.room.id}`, kind: 'room' as const, label: post.room.name }] : []),
      ...post.tags.map((tag) => ({ id: `tag:${tag.toLowerCase()}`, kind: 'tag' as const, label: `#${tag}` })),
    ];
    for (const key of keys) {
      const group = groups.get(key.id) ?? { ...key, posts: [] };
      group.posts.push(post.id);
      groups.set(key.id, group);
    }
  }
  // 꿰는 글이 똑같은 묶음(예: 공부방과 #공부 노트)은 실 한 가닥으로 합치고 이름을 모아 적음. 같은 길로 실이 겹쳐 뭉치지 않게
  const merged = new Map<string, Omit<Thread, 'color'>>();
  for (const group of groups.values()) {
    if (group.posts.length < 2) continue;
    const key = group.posts.join(' ');
    const same = merged.get(key);
    merged.set(key, same ? { ...same, id: `${same.id}+${group.id}`, kind: same.kind === 'room' ? 'room' : group.kind, label: `${same.label} ${group.label}` } : group);
  }
  return [...merged.values()]
    .sort((a, b) => b.posts.length - a.posts.length || a.label.localeCompare(b.label, 'ko'))
    .slice(0, MAX_THREADS)
    .map((group, i) => ({ ...group, color: (i % YARN_COLORS) + 1 }));
}

export interface Slot {
  x: number;
  y: number;
  /** 카드를 비스듬히 꽂은 각도(deg) */
  tilt: number;
}

export interface BoardLayout {
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  slots: Map<string, Slot>;
}

// 글 ID 로 0 이상 1 미만의 수를 늘 같게 뽑음 (FNV-1a)
function seeded(text: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (const char of text) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/**
 * 판 너비에 맞춰 카드를 꽂을 자리. 같은 방의 글이 이웃하게 글이 많은 방부터 모으고, 방 안에서는 새 글부터
 * 칸 사이로 조금씩 흔들고 비스듬히 꽂아서 손으로 꽂은 것처럼 보이게 함. 좁은 화면은 두 줄
 */
export function boardLayout(posts: BlogPostSummary[], width: number): BoardLayout {
  const narrow = width < 520;
  const pad = narrow ? 14 : 30;
  const gap = narrow ? 14 : 30;
  const cardWidth = narrow ? Math.max(120, Math.floor((width - pad * 2 - gap) / 2)) : 200;
  const cardHeight = narrow ? 172 : 188;
  const cols = Math.max(2, Math.floor((width - pad * 2 + gap) / (cardWidth + gap)));
  const rowHeight = cardHeight + gap + (narrow ? 10 : 18);
  const left = Math.max(pad, (width - (cols * cardWidth + (cols - 1) * gap)) / 2);
  // 방마다 글 수와 처음 나온 차례. 글이 많은 방이 앞이라 한 실로 꿰인 글이 한 줄에 모여 실이 카드를 덜 가로지름
  const rooms = new Map<string, { count: number; first: number }>();
  posts.forEach((post, i) => {
    if (!post.room) return;
    const room = rooms.get(post.room.id) ?? { count: 0, first: i };
    rooms.set(post.room.id, { ...room, count: room.count + 1 });
  });
  const rank = (post: BlogPostSummary) => {
    const room = post.room && rooms.get(post.room.id);
    return room ? [-room.count, room.first] : [0, Infinity];
  };
  const ordered = [...posts].sort((a, b) => {
    const [ca, fa] = rank(a);
    const [cb, fb] = rank(b);
    return ca! - cb! || fa! - fb! || b.createdAt.localeCompare(a.createdAt);
  });
  const slots = new Map<string, Slot>();
  ordered.forEach((post, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = left + col * (cardWidth + gap) + (seeded(post.id, 1) - 0.5) * gap * 0.8;
    const y = pad + 22 + row * rowHeight + (col % 2) * gap * 0.5 + (seeded(post.id, 2) - 0.5) * gap * 0.6;
    slots.set(post.id, {
      x: Math.min(Math.max(x, 6), width - cardWidth - 6),
      y: Math.max(y, 10),
      tilt: (seeded(post.id, 3) - 0.5) * 7,
    });
  });
  const rows = Math.ceil(ordered.length / cols);
  return { width, height: pad * 2 + 22 + rows * rowHeight + gap * 0.5, cardWidth, cardHeight, slots };
}

/**
 * 두 압정 사이에 건 실. 같은 줄의 카드끼리는 카드 위쪽으로 둥글게 걸어 카드 글씨를 가리지 않고, 줄이 다르면 아래로 처지게 함
 * 실 색마다 조금씩 다르게 휘어 같은 카드 사이에 실이 둘이어도 보임
 */
export function yarnPath(from: { x: number; y: number }, to: { x: number; y: number }, color: number): string {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const bend = 18 + distance * 0.1 + color * 5;
  const cx = (from.x + to.x) / 2;
  const sameRow = Math.abs(to.y - from.y) < 60;
  // 위로 걸 때는 곡선 꼭대기((y1 + 2cy + y2) / 4)가 판 위 끝 6px 아래에 머물게 함
  const cy = sameRow ? Math.max(Math.min(from.y, to.y) - bend, 12 - (from.y + to.y) / 2) : Math.max(from.y, to.y) + bend;
  return `M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

/** 이보다 좁은 화면(휴대폰)은 판 전체 대신 실 한 가닥을 따라 내려가는 수사 기록으로 보여 줌 */
export const TRAIL_BELOW = 560;

export interface TrailLayout {
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  /** 글 차례대로(위에서 아래로) 카드 자리 */
  slots: Slot[];
  /** 카드 사이 간격. 실 꼬리표가 이 틈에 매달림 */
  gap: number;
}

/**
 * 실 따라가기의 카드 자리. 카드는 한 줄로 위에서 아래로 꽂고, 왼쪽 여백은 실이 지나가게 비워 둠
 * 카드마다 조금씩 들쭉날쭉하고 비스듬히 꽂아 손으로 꽂은 것처럼 보이게 함
 */
export function trailLayout(ids: string[], width: number): TrailLayout {
  const top = 22;
  const margin = 34;
  const cardHeight = 182;
  const gap = 46;
  const cardWidth = Math.max(160, width - margin - 22);
  const slots = ids.map((id, i) => ({
    x: margin + seeded(id, 4) * 8,
    y: top + i * (cardHeight + gap),
    tilt: (seeded(id, 5) - 0.5) * 3,
  }));
  // 마지막 카드 아래로 실 끝이 늘어지고 손글씨 한 줄이 들어갈 자리
  return { width, height: top + ids.length * cardHeight + Math.max(0, ids.length - 1) * gap + 84, cardWidth, cardHeight, slots, gap };
}

const seoulDay = (iso: string) => Date.parse(formatStamp(iso).slice(0, 10).replace(/\./g, '-'));

/** 꿴 두 글 사이가 얼마나 떨어졌는지. 서울 날짜로 셈 */
export function gapLabel(from: string, to: string): string {
  const days = Math.round((seoulDay(to) - seoulDay(from)) / 86_400_000);
  if (days < 1) return '같은 날';
  if (days < 30) return `${days}일 뒤`;
  if (days < 365) return `${Math.round(days / 30)}달 뒤`;
  return `${Math.round(days / 365)}년 뒤`;
}

/** 실 꼬리표의 대략 너비(px). 한글은 넓고 영문, 숫자는 좁게 셈 */
export const labelWidth = (text: string) => [...text].reduce((sum, char) => sum + (char.codePointAt(0)! > 0x1100 ? 12.5 : 7), 18);
