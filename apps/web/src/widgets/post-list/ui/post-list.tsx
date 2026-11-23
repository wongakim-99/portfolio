'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { formatNumber } from '@shared/lib';
import { LikeButton } from '@features/like-content';
import { QuickPostForm } from '@features/write-post';
import { listPosts, PostCard, type Post, type PostSummary } from '@entities/post';
import { AuthorLink, useSession } from '@entities/user';
import './post-list.css';

interface PostListProps {
  /** 이 회원의 글만 (회원 페이지) */
  author?: string;
  /** 맨 위에 짧은 글 쓰기 칸을 둠 (피드 첫 화면) */
  composer?: boolean;
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

// 방금 쓴 글은 목록 모양으로 바꿔 맨 위에 붙임 (짧은 글이라 본문 전부가 보임)
const summaryOf = ({ body, ...post }: Post): PostSummary => ({ ...post, excerpt: body, truncated: false });

/** 쓰레드처럼 쌓이는 글 목록. 최근 글부터 10개씩 받고 '글 더 보기' 로 이어 받음 */
export function PostList({ author, composer = false, loadingText, emptyText, errorText, retry = false }: PostListProps) {
  const { user, requestLogin } = useSession();
  const [state, setState] = useState<ListState>({ posts: [], cursor: null, status: 'loading' });

  const load = useCallback(
    (before: string | null) =>
      listPosts({ before, author }).then(
        (page) => setState((prev) => ({ posts: before ? [...prev.posts, ...page.posts] : page.posts, cursor: page.nextCursor, status: 'ready' })),
        () => setState((prev) => ({ ...prev, status: 'error' })),
      ),
    [author],
  );

  // 로그인하거나 로그아웃하면 좋아요를 눌렀는지가 달라지므로 다시 받음
  const viewer = user?.id ?? null;
  useEffect(() => {
    load(null);
  }, [load, viewer]);

  const { posts, cursor, status } = state;
  return (
    <>
      {composer &&
        (user ? (
          <QuickPostForm onCreated={(post) => setState((prev) => ({ ...prev, posts: [summaryOf(post), ...prev.posts] }))} />
        ) : (
          <p className="feed-invite">
            로그인하면 여기서 바로 짧은 글을 남길 수 있어요.{' '}
            <button className="text-btn" type="button" onClick={() => requestLogin()}>
              로그인 / 가입
            </button>
          </p>
        ))}
      <div aria-live="polite">
        {status === 'loading' && !posts.length && loadingText && <p className="community-empty">{loadingText}</p>}
        {posts.map((post) => (
          <PostCard
            key={`${viewer}-${post.id}`}
            post={post}
            author={<AuthorLink authorId={post.authorId} authorName={post.authorName} authorAvatarUrl={post.authorAvatarUrl} />}
            actions={
              <>
                <LikeButton target="post" id={post.id} likeCount={post.likeCount} liked={post.liked} />
                <Link className="feed-replies" href={routes.post(post.id)} aria-label={`답글 ${post.commentCount}개 보기`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 12.5c0 4-3.6 7-8 7-1.2 0-2.3-.2-3.3-.6L4 20l1.2-3.7C4.4 15.2 4 13.9 4 12.5c0-4 3.6-7 8-7s8 3 8 7Z" />
                  </svg>
                  {post.commentCount ? formatNumber(post.commentCount) : '답글'}
                </Link>
              </>
            }
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
