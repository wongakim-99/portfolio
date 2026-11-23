'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { BlogCard, listBlogPosts, type BlogListQuery, type BlogPostSummary } from '@entities/blog-post';
import { useSession } from '@entities/user';
import { EmptyDesk } from './empty-desk';
import './blog-post-grid.css';

interface GridState {
  posts: BlogPostSummary[];
  cursor: string | null;
  status: 'loading' | 'ready' | 'error';
}

// 카드 두 줄씩. 거르기가 바뀌거나 로그인이 바뀌면 처음부터 다시 받음
export function BlogPostGrid({ query }: { query: BlogListQuery }) {
  const { user, ready } = useSession();
  const userId = user?.id ?? null;
  const { room = null, tag = null, q = null, visibility = null } = query;
  const filtered = Boolean(room || tag || q || visibility);
  // 무엇으로 걸렀는지에 맞춘 빈 목록 문장. 검색, 태그, 방, 공개 범위 순으로 봄
  const emptyText = q ? '찾는 글이 없어요.' : tag ? '이 태그가 붙은 글이 아직 없어요.' : room ? '이 방은 아직 비어 있어요.' : visibility ? '이 공개 범위의 글이 없어요.' : '아직 글이 없습니다.';
  const [state, setState] = useState<GridState>({ posts: [], cursor: null, status: 'loading' });

  const load = useCallback(
    (before: string | null) =>
      listBlogPosts({ before, room, tag, q, visibility }).then(
        (page) => setState((prev) => ({ posts: before ? [...prev.posts, ...page.posts] : page.posts, cursor: page.nextCursor, status: 'ready' })),
        () => setState((prev) => ({ ...prev, status: 'error' })),
      ),
    [room, tag, q, visibility],
  );

  useEffect(() => {
    if (ready) load(null);
  }, [ready, userId, load]);

  const { posts, cursor, status } = state;
  return (
    <section className="blog-grid-wrap" aria-label="글 목록" aria-busy={status === 'loading'}>
      {tag && (
        <p className="blog-filter-note">
          <b>#{tag}</b> 태그가 붙은 글
          <Link className="text-btn" href={routes.blogList({ room, q, visibility })} scroll={false}>
            태그 풀기
          </Link>
        </p>
      )}
      <div className="blog-grid" aria-live="polite">
        {posts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
      {status === 'loading' && !posts.length && <p className="blog-grid-empty">글을 불러오는 중입니다.</p>}
      {status === 'ready' && !posts.length && (
        <div className="blog-grid-empty is-illustrated">
          <EmptyDesk />
          <p>
            {emptyText}
            {filtered && (
              <Link className="text-btn" href={routes.blog}>
                모든 글 보기
              </Link>
            )}
          </p>
        </div>
      )}
      {status === 'error' && (
        <p className="blog-grid-empty">
          지금은 글을 불러오지 못합니다. 잠시 뒤에 다시 시도해 주세요.
          <button
            className="text-btn"
            type="button"
            onClick={() => {
              setState({ posts: [], cursor: null, status: 'loading' });
              load(null);
            }}
          >
            다시 시도
          </button>
        </p>
      )}
      {cursor && status === 'ready' && (
        <button className="btn-line blog-more" type="button" onClick={() => load(cursor)}>
          글 더 보기
        </button>
      )}
    </section>
  );
}
