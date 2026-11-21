'use client';

import { useCallback, useEffect, useState } from 'react';
import { BlogPostRow, listBlogPosts, type BlogPostSummary } from '@entities/blog-post';
import { useSession } from '@entities/user';

interface ListState {
  posts: BlogPostSummary[];
  cursor: string | null;
  status: 'loading' | 'ready' | 'error';
}

// 최근 글부터 10개씩. 로그인하거나 나가면 읽을 수 있는 글이 달라지므로 처음부터 다시 받음
export function BlogPostList() {
  const { user, ready } = useSession();
  const userId = user?.id ?? null;
  const [state, setState] = useState<ListState>({ posts: [], cursor: null, status: 'loading' });

  const load = useCallback(
    (before: string | null) =>
      listBlogPosts(before).then(
        (page) => setState((prev) => ({ posts: before ? [...prev.posts, ...page.posts] : page.posts, cursor: page.nextCursor, status: 'ready' })),
        () => setState((prev) => ({ ...prev, status: 'error' })),
      ),
    [],
  );

  useEffect(() => {
    if (ready) load(null);
  }, [ready, userId, load]);

  const { posts, cursor, status } = state;
  return (
    <>
      <div aria-live="polite">
        {status === 'loading' && !posts.length && <p className="community-empty">글을 불러오는 중입니다.</p>}
        {posts.map((post) => (
          <BlogPostRow key={post.id} post={post} />
        ))}
        {status === 'ready' && !posts.length && <p className="community-empty">아직 글이 없습니다.</p>}
        {status === 'error' && (
          <>
            <p className="community-empty">지금은 글을 불러오지 못합니다. 잠시 뒤에 다시 시도해 주세요.</p>
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
          </>
        )}
      </div>
      {cursor && status === 'ready' && (
        <button className="btn-line community-more" type="button" onClick={() => load(cursor)}>
          글 더 보기
        </button>
      )}
    </>
  );
}
