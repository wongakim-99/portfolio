'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { routes } from '@shared/config';
import { cx } from '@shared/lib';
import { listBlogPosts, type BlogListQuery, type BlogPostSummary } from '@entities/blog-post';
import { useSession } from '@entities/user';
import { boardLayout, labelWidth, threadsOf, TRAIL_BELOW, yarnPath } from '../lib/board';
import { saveMovedCards, useMovedCards } from '../model/moved-cards';
import { BoardCard } from './board-card';
import { ThreadTrail } from './thread-trail';
import './thread-board.css';

// 블로그 '코르크판에 꽂기' 보기. 글을 압정으로 꽂은 메모 카드로 늘어놓고, 같은 태그나 같은 방의 글끼리 털실로 이음
// 카드에 마우스를 올리면 그 글에서 뻗은 실만 진해지고 실 위에 무엇으로 이어졌는지 꼬리표가 붙음
// 카드는 끌어서 옮길 수 있고, 옮긴 자리는 이 브라우저에만 남음. 휴대폰처럼 좁은 화면은 실 하나를 따라 내려가는 보기(ThreadTrail)

/** 코르크판 나무 틀 두께(px). thread-board.css 의 .thread-board border 와 같게 */
const FRAME = 12;

/** 판에 꽂는 글 수. 목록 API 를 이만큼까지 이어 받음 */
const MAX_POSTS = 60;
/** 손을 떼기 전에 이만큼 움직여야 끌기로 봄. 덜 움직이면 그냥 누른 것 */
const DRAG_START = 5;

type Focus = { post: string } | { thread: string } | null;

interface Drag {
  id: string;
  pointer: number;
  startX: number;
  startY: number;
  fromX: number;
  fromY: number;
  moving: boolean;
  /** 끄는 동안 마지막 자리. 놓을 때 이것을 남김 */
  last?: { fx: number; y: number };
}

// 두 압정 사이 곡선의 한가운데 (2차 베지어의 t=0.5)
function middleOf(from: { x: number; y: number }, to: { x: number; y: number }, color: number) {
  const control = yarnPath(from, to, color).split('Q')[1]!.trim().split(' ').map(Number);
  return { x: (from.x + 2 * control[0]! + to.x) / 4, y: (from.y + 2 * control[1]! + to.y) / 4 };
}

export function ThreadBoard({ query }: { query: BlogListQuery }) {
  const { user, ready } = useSession();
  const userId = user?.id ?? null;
  const { room = null, tag = null, q = null, visibility = null } = query;
  const [state, setState] = useState<{ posts: BlogPostSummary[]; status: 'loading' | 'ready' | 'error' }>({ posts: [], status: 'loading' });
  const [width, setWidth] = useState(0);
  const moved = useMovedCards();
  // 끄는 중인 카드와 그 자리. 놓기 전까지는 화면에만 그리고 저장하지 않음
  const [live, setLive] = useState<{ id: string; fx: number; y: number } | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [attempt, setAttempt] = useState(0);
  const wrap = useRef<HTMLElement>(null);
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

  // 화면 폭에 맞춰 판과 실 따라가기 가운데 고르고 카드 자리를 다시 정함
  useEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { posts, status } = state;
  const threads = useMemo(() => threadsOf(posts), [posts]);
  const narrow = width > 0 && width < TRAIL_BELOW;
  const dragging = live?.id ?? null;
  const layout = useMemo(() => (width && !narrow ? boardLayout(posts, width - FRAME * 2) : null), [posts, width, narrow]);

  const places = useMemo(() => {
    const result = new Map<string, { x: number; y: number; tilt: number }>();
    if (!layout) return result;
    for (const [id, slot] of layout.slots) {
      const own = live?.id === id ? live : moved[id];
      result.set(id, own ? { x: Math.min(Math.max(own.fx * layout.width, 0), layout.width - layout.cardWidth), y: Math.max(own.y, 0), tilt: slot.tilt } : slot);
    }
    return result;
  }, [layout, moved, live]);

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
    }
    current.last = { fx: (current.fromX + dx) / layout.width, y: current.fromY + dy };
    setLive({ id: current.id, ...current.last });
  };
  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moving) return;
    justDragged.current = true;
    if (current.last) saveMovedCards({ ...moved, [current.id]: current.last });
    setLive(null);
  };

  return (
    <section className="thread-board-wrap" ref={wrap} aria-label="코르크판에 꽂은 글" aria-busy={status === 'loading'}>
      <p className="hand thread-board-note">
        {narrow ? '실을 하나 골라 따라 내려가 보세요. 같은 태그나 같은 방의 글을 오래된 순서로 꿰었어요.' : '같은 태그나 같은 방에 든 글끼리 실로 이었어요. 카드는 끌어서 옮길 수 있어요.'}
      </p>
      {narrow && posts.length > 0 && <ThreadTrail posts={posts} threads={threads} width={width - FRAME} />}
      <div className={cx('thread-board', focus && 'has-focus')} hidden={narrow && posts.length > 0} style={{ height: height || undefined }}>
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
      {!narrow && (threads.length > 0 || Object.keys(moved).length > 0) && (
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
            <button className="text-btn" type="button" onClick={() => saveMovedCards({})}>
              카드 처음 자리로
            </button>
          )}
        </div>
      )}
    </section>
  );
}
