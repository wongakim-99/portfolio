'use client';

import { useCallback, useEffect, useState } from 'react';
import { listPosts, PostRow, type PostSummary } from '@entities/post';
import { AuthorLink } from '@entities/user';

interface PostListProps {
  /** 이 회원의 글만. 회원 페이지에서는 글쓴이 칸을 비움 */
  author?: string;
  loadingText?: string;
  emptyText: string;
  errorText: string;
  /** 불러오지 못했을 때 처음부터 다시 받는 버튼을 둠 */
  retry?: boolean;
}

interface ListState {
  posts: PostSummary[];
  cursor: string | null;
  status: 'loading' | 'ready' | 'error';
}

// 최근 글부터 10개씩 받고 '글 더 보기' 로 이어 받음
export function PostList({ author, loadingText, emptyText, errorText, retry = false }: PostListProps) {
  const [state, setState] = useState<ListState>({ posts: [], cursor: null, status: 'loading' });

  const load = useCallback(
    (before: string | null) =>
      listPosts({ before, author }).then(
        (page) => setState((prev) => ({ posts: before ? [...prev.posts, ...page.posts] : page.posts, cursor: page.nextCursor, status: 'ready' })),
        () => setState((prev) => ({ ...prev, status: 'error' })),
      ),
    [author],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  const { posts, cursor, status } = state;
  return (
    <>
      <div aria-live="polite">
        {status === 'loading' && !posts.length && loadingText && <p className="community-empty">{loadingText}</p>}
        {posts.map((post) => (
          <PostRow
            key={post.id}
            post={post}
            author={author ? undefined : <AuthorLink authorId={post.authorId} authorName={post.authorName} authorAvatarUrl={post.authorAvatarUrl} />}
          />
        ))}
        {status === 'ready' && !posts.length && <p className="community-empty">{emptyText}</p>}
        {status === 'error' && (
          <>
            <p className="community-empty">{errorText}</p>
            {retry && (
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
            )}
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
