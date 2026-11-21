'use client';

import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { formatDate, useDocumentTitle } from '@shared/lib';
import { BackLink, NO_STATUS, Sheet, type Status } from '@shared/ui';
import { CommentThread } from '@widgets/comment-thread';
import { PostActions } from '@features/manage-post';
import { ReportDialog } from '@features/report-content';
import { getPost, type Post } from '@entities/post';
import type { ReportTarget } from '@entities/report';
import { AuthorLink, useSession } from '@entities/user';
import './post-page.css';

export function PostPage({ postId }: { postId: string }) {
  const { user, requestLogin } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [report, setReport] = useState<ReportTarget | null>(null);
  useDocumentTitle(post ? `${post.title} | 김가원 피드` : null);

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
      <header className="community-article-head">
        <h2>{missing ? '글을 찾을 수 없습니다' : post?.title}</h2>
        {post && (
          <>
            <p className="community-meta">
              <AuthorLink authorId={post.authorId} authorName={post.authorName} authorAvatarUrl={post.authorAvatarUrl} />
              <span>{formatDate(post.createdAt)}</span>
              <span>댓글 {post.commentCount}</span>
            </p>
            <PostActions post={post} onReport={beginReport} onStatus={setStatus} />
          </>
        )}
      </header>
      <div className="community-body">{missing ? '삭제되었거나 지금은 읽을 수 없는 글입니다.' : post?.body}</div>
      {!missing && (
        <CommentThread
          postId={postId}
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
