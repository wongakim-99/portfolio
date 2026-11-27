'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { routes } from '@shared/config';
import { cx, formatDate, readStore, writeStore } from '@shared/lib';
import { listBlogPosts, type BlogListQuery, type BlogPostSummary } from '@entities/blog-post';
import { useSession } from '@entities/user';
import { boardLayout, threadsOf, yarnPath, type Thread } from '../lib/board';
import './thread-board.css';

// 블로그 '코르크판에 꽂기' 보기. 글을 압정으로 꽂은 메모 카드로 늘어놓고, 같은 태그나 같은 방의 글끼리 털실로 이음
// 카드에 마우스를 올리면 그 글에서 뻗은 실만 진해지고 실 위에 무엇으로 이어졌는지 꼬리표가 붙음
// 카드는 끌어서 옮길 수 있고, 옮긴 자리는 이 브라우저에만 남음

/** 판에 꽂는 글 수. 목록 API 를 이만큼까지 이어 받음 */
const MAX_POSTS = 60;
const MOVED_KEY = 'blog-board-moved';
/** 손을 떼기 전에 이만큼 움직여야 끌기로 봄. 덜 움직이면 그냥 누른 것 */
const DRAG_START = 5;

/** 끌어서 옮긴 카드 자리. x 는 판 너비에 대한 비율이라 화면 폭이 바뀌어도 비슷한 자리 */
type Moved = Record<string, { fx: number; y: number }>;
type Focus = { post: string } | { thread: string } | null;

interface Drag {
  id: string;
  pointer: number;
  startX: number;
  startY: number;
  fromX: number;
  fromY: number;
  moving: boolean;
}

// 실 꼬리표의 대략 너비. 한글은 넓고 영문, 숫자는 좁게 셈
const labelWidth = (text: string) => [...text].reduce((sum, char) => sum + (char.codePointAt(0)! > 0x1100 ? 12.5 : 7), 18);

// 두 압정 사이 곡선의 한가운데 (2차 베지어의 t=0.5)
function middleOf(from: { x: number; y: number }, to: { x: number; y: number }, color: number) {
  const control = yarnPath(from, to, color).split('Q')[1]!.trim().split(' ').map(Number);
  return { x: (from.x + 2 * control[0]! + to.x) / 4, y: (from.y + 2 * control[1]! + to.y) / 4 };
}

function BoardCard({ post, threads }: { post: BlogPostSummary; threads: Thread[] }) {
  return (
    <article className="thread-card-paper" data-locked={post.locked || undefined}>
      {post.cover && (
        <span className="thread-card-photo" aria-hidden="true">
          {/* 글 사진은 API 가 줄여 둔 파일이라 next/image 최적화를 거치지 않음 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.cover} alt="" loading="lazy" decoding="async" draggable={false} />
        </span>
      )}
      <p className="thread-card-meta">
        {post.room && <span className="thread-card-room">{post.room.name}</span>}
        <span>{formatDate(post.createdAt)}</span>
      </p>
      <h3 className="thread-card-title">
        <Link href={routes.blogPost(post.id)} draggable={false}>
          {post.title}
        </Link>
      </h3>
      {post.excerpt && <p className="thread-card-excerpt">{post.excerpt}</p>}
      {post.locked && (
        <span className="thread-card-stamp" aria-label="잠긴 글">
          기밀
        </span>
      )}
      {post.tags.length > 0 && <p className="thread-card-tags">{post.tags.map((tag) => `#${tag}`).join(' ')}</p>}
      {threads.length > 0 && <span className="sr">이어진 실: {threads.map((thread) => thread.label).join(', ')}</span>}
    </article>
  );
}

export function ThreadBoard({ query }: { query: BlogListQuery }) {
  const { user, ready } = useSession();
  const userId = user?.id ?? null;
  const { room = null, tag = null, q = null, visibility = null } = query;
  const [state, setState] = useState<{ posts: BlogPostSummary[]; status: 'loading' | 'ready' | 'error' }>({ posts: [], status: 'loading' });
  const [width, setWidth] = useState(0);
  const [moved, setMoved] = useState<Moved>(() => readStore<Moved>(MOVED_KEY) ?? {});
  const [focus, setFocus] = useState<Focus>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);

  // 거른 목록을 끝까지(MAX_POSTS 까지) 이어 받음. 로그인이 바뀌면 보이는 글이 달라져 다시 받음
  useEffect(() => {
    if (!ready) return;
    let active = true;
    (async () => {
      const posts: BlogPostSummary[] = [];
      let before: string | null = null;
      do {
        const page = await listBlogPosts({ before, room, tag, q, visibility });
        posts.push(...page.posts);
        before = page.nextCursor;
      } while (before && posts.length < MAX_POSTS);
      return posts.slice(0, MAX_POSTS);
    })().then(
      (posts) => active && setState({ posts, status: 'ready' }),
      () => active && setState({ posts: [], status: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [ready, userId, room, tag, q, visibility, attempt]);

  // 판 너비에 맞춰 카드 자리를 다시 정함
  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 옮긴 자리는 손을 뗀 뒤에 한 번 남김
  useEffect(() => {
    if (!dragging) writeStore(MOVED_KEY, Object.keys(moved).length ? moved : null);
  }, [moved, dragging]);

  const { posts, status } = state;
  const threads = useMemo(() => threadsOf(posts), [posts]);
  const layout = useMemo(() => (width ? boardLayout(posts, width) : null), [posts, width]);

  const places = useMemo(() => {
    const result = new Map<string, { x: number; y: number; tilt: number }>();
    if (!layout) return result;
    for (const [id, slot] of layout.slots) {
      const own = moved[id];
      result.set(id, own ? { x: Math.min(Math.max(own.fx * layout.width, 0), layout.width - layout.cardWidth), y: Math.max(own.y, 0), tilt: slot.tilt } : slot);
    }
    return result;
  }, [layout, moved]);

  const height = layout ? Math.max(layout.height, ...[...places.values()].map((place) => place.y + layout.cardHeight + 30)) : 0;
  const pin = (id: string) => {
    const place = places.get(id)!;
    return { x: place.x + layout!.cardWidth / 2, y: place.y + 9 };
  };

  // 마우스를 올린 글이나 실에 걸린 실과 글
  const hotThreads = focus ? new Set(threads.filter((thread) => ('post' in focus ? thread.posts.includes(focus.post) : thread.id === focus.thread)).map((thread) => thread.id)) : null;
  const hotPosts = hotThreads ? new Set([...threads.filter((thread) => hotThreads.has(thread.id)).flatMap((thread) => thread.posts), ...(focus && 'post' in focus ? [focus.post] : [])]) : null;

  const onPointerDown = (event: ReactPointerEvent<HTMLLIElement>, id: string) => {
    // 손가락은 판을 넘겨 보는 데 쓰고, 끌기는 마우스, 펜만
    if (event.pointerType === 'touch' || event.button !== 0) return;
    const place = places.get(id);
    if (!place) return;
    drag.current = { id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, fromX: place.x, fromY: place.y, moving: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLLIElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId || !layout) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moving) {
      if (Math.hypot(dx, dy) < DRAG_START) return;
      current.moving = true;
      try {
        // 판 밖으로 끌어도 놓칠 때까지 이 카드가 포인터를 받음
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // 그새 손을 뗀 포인터라 붙잡지 못해도 끌기는 이어 감
      }
      setDragging(current.id);
    }
    setMoved((prev) => ({ ...prev, [current.id]: { fx: (current.fromX + dx) / layout.width, y: current.fromY + dy } }));
  };
  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moving) return;
    justDragged.current = true;
    setDragging(null);
  };

  return (
    <section className="thread-board-wrap" aria-label="코르크판에 꽂은 글" aria-busy={status === 'loading'}>
      <p className="hand thread-board-note">같은 태그나 같은 방에 든 글끼리 실로 이었어요. 카드는 끌어서 옮길 수 있어요.</p>
      <div className={cx('thread-board', focus && 'has-focus')} ref={board} style={{ height: height || undefined }}>
        {layout && (
          <ul className="thread-board-cards">
            {posts.map((post, i) => {
              const place = places.get(post.id);
              if (!place) return null;
              const own = threads.filter((thread) => thread.posts.includes(post.id));
              const style = {
                left: place.x,
                top: place.y,
                width: layout.cardWidth,
                height: layout.cardHeight,
                '--tilt': `${place.tilt}deg`,
                '--delay': `${Math.min(i, 20) * 45}ms`,
              } as CSSProperties;
              return (
                <li
                  key={post.id}
                  className={cx('thread-card', hotPosts?.has(post.id) && 'is-hot', hotPosts && !hotPosts.has(post.id) && 'is-dim', dragging === post.id && 'is-dragging')}
                  style={style}
                  onMouseEnter={() => !dragging && setFocus({ post: post.id })}
                  onMouseLeave={() => !dragging && setFocus(null)}
                  onFocus={() => setFocus({ post: post.id })}
                  onBlur={() => setFocus(null)}
                  onPointerDown={(event) => onPointerDown(event, post.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onClickCapture={(event) => {
                    // 끌고 나서 손을 뗀 것은 글 열기로 보지 않음
                    if (!justDragged.current) return;
                    justDragged.current = false;
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <BoardCard post={post} threads={own} />
                </li>
              );
            })}
          </ul>
        )}
        {layout && (
          <svg className="thread-board-yarn" viewBox={`0 0 ${layout.width} ${height}`} width={layout.width} height={height} aria-hidden="true">
            {threads.map((thread, t) =>
              thread.posts.slice(1).map((to, i) => {
                const from = thread.posts[i]!;
                return (
                  <path
                    key={`${thread.id}:${from}:${to}`}
                    className={cx('yarn', `yarn-${thread.color}`, hotThreads?.has(thread.id) && 'is-hot', hotThreads && !hotThreads.has(thread.id) && 'is-dim')}
                    style={{ '--delay': `${300 + (t * 3 + i) * 70}ms` } as CSSProperties}
                    d={yarnPath(pin(from), pin(to), thread.color)}
                    pathLength={1}
                  />
                );
              }),
            )}
            {threads
              .filter((thread) => hotThreads?.has(thread.id))
              .map((thread) => {
                const at = Math.floor((thread.posts.length - 1) / 2);
                const middle = middleOf(pin(thread.posts[at]!), pin(thread.posts[at + 1]!), thread.color);
                const labelW = labelWidth(thread.label);
                return (
                  <g key={thread.id} className={`yarn-label yarn-${thread.color}`} transform={`translate(${middle.x - labelW / 2} ${middle.y - 11})`}>
                    <rect width={labelW} height={22} rx={3} />
                    <text x={labelW / 2} y={15}>
                      {thread.label}
                    </text>
                  </g>
                );
              })}
            {posts.map((post) => {
              const at = places.has(post.id) ? pin(post.id) : null;
              const color = threads.find((thread) => thread.posts.includes(post.id))?.color;
              return (
                at && (
                  <g key={post.id} className={cx('pin', color ? `yarn-${color}` : 'is-plain')}>
                    <circle cx={at.x} cy={at.y} r={6.5} />
                    <circle className="pin-shine" cx={at.x - 2} cy={at.y - 2} r={2} />
                  </g>
                )
              );
            })}
          </svg>
        )}
        {status === 'loading' && !posts.length && <p className="thread-board-empty">글을 꽂는 중입니다.</p>}
        {status === 'ready' && !posts.length && (
          <p className="thread-board-empty">
            꽂을 글이 없어요.
            <Link className="text-btn" href={routes.blogList({ view: 'board' })}>
              모든 글 보기
            </Link>
          </p>
        )}
        {status === 'error' && (
          <p className="thread-board-empty">
            지금은 글을 불러오지 못합니다.
            <button className="text-btn" type="button" onClick={() => setAttempt((value) => value + 1)}>
              다시 시도
            </button>
          </p>
        )}
      </div>
      {(threads.length > 0 || Object.keys(moved).length > 0) && (
        <div className="thread-board-foot">
          {threads.length > 0 && (
            <ul className="thread-legend" aria-label="걸려 있는 실">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    className={cx(hotThreads?.has(thread.id) && 'is-hot')}
                    onMouseEnter={() => setFocus({ thread: thread.id })}
                    onMouseLeave={() => setFocus(null)}
                    onFocus={() => setFocus({ thread: thread.id })}
                    onBlur={() => setFocus(null)}
                  >
                    <span className={`thread-swatch yarn-${thread.color}`} aria-hidden="true" />
                    {thread.label}
                    <small>{thread.posts.length}편</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {Object.keys(moved).length > 0 && (
            <button className="text-btn" type="button" onClick={() => setMoved({})}>
              카드 처음 자리로
            </button>
          )}
        </div>
      )}
    </section>
  );
}
