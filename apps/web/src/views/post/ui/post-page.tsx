'use client';

import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { useDocumentTitle } from '@shared/lib';
import { BackLink, NO_STATUS, Sheet, type Status } from '@shared/ui';
import { CommentThread } from '@widgets/comment-thread';
import { LikeButton } from '@features/like-content';
import { PostActions } from '@features/manage-post';
import { ReportDialog } from '@features/report-content';
import { getPost, PostCard, type Post } from '@entities/post';
import type { ReportTarget } from '@entities/report';
import { AuthorLink, useSession } from '@entities/user';

export function PostPage({ postId }: { postId: string }) {
  const { user, requestLogin } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [report, setReport] = useState<ReportTarget | null>(null);
  // 짧은 글은 제목이 없어서 본문 앞부분을 탭 제목으로 씀
  useDocumentTitle(post ? `${post.title || post.body.slice(0, 30) || `${post.authorName} 님의 사진`} | 김가원 피드` : null);

  useEffect(() => {
    let active = true;
    getPost(postId).then(
      (value) => active && setPost(value),
      () => active && setMissing(true),
    );
    return () => {
      active = false;
    };
  }, [postId]);

  // 신고는 로그인한 회원만. 로그인 전이면 로그인 창부터
  const beginReport = (target: ReportTarget) => (user ? setReport(target) : requestLogin());

  return (
    <Sheet as="article" className="community-sheet">
      <BackLink href={routes.feed}>모든 글</BackLink>
      {missing && (
        <header className="community-article-head">
          <h2>글을 찾을 수 없습니다</h2>
          <p className="community-meta">삭제되었거나 지금은 읽을 수 없는 글입니다.</p>
        </header>
      )}
      {post && (
        <PostCard
          full
          post={post}
          author={<AuthorLink authorId={post.authorId} authorName={post.authorName} authorAvatarUrl={post.authorAvatarUrl} />}
          menu={<PostActions post={post} onReport={beginReport} onStatus={setStatus} />}
          actions={
            <>
              <LikeButton target="post" id={post.id} likeCount={post.likeCount} liked={post.liked} onError={(message) => setStatus({ message, tone: 'error' })} />
              <span className="community-meta">답글 {post.commentCount}</span>
            </>
          }
        />
      )}
      {post && (
        <CommentThread
          postId={postId}
          postAuthorId={post.authorId}
          onCountChange={(delta) => setPost((value) => value && { ...value, commentCount: Math.max(0, value.commentCount + delta) })}
          onReport={beginReport}
          status={status}
          onStatus={setStatus}
        />
      )}
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </Sheet>
  );
}
