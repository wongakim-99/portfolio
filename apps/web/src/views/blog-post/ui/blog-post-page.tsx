'use client';

import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { formatDate, useDocumentTitle } from '@shared/lib';
import { BackLink, FormStatus, NO_STATUS, Sheet, type Status } from '@shared/ui';
import { BlogLock } from '@widgets/blog-lock';
import { BlogPostActions } from '@features/manage-blog-post';
import { getBlogPost, VisibilityStamp, type BlogPost } from '@entities/blog-post';
import { useSession } from '@entities/user';

export function BlogPostPage({ postId }: { postId: string }) {
  const { user, ready } = useSession();
  const userId = user?.id ?? null;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  useDocumentTitle(post ? `${post.title} | 김가원 블로그` : null);

  // 누가 보느냐에 따라 본문이 열리거나 잠기므로 로그인 확인이 끝난 뒤, 로그인이 바뀔 때마다 다시 받음
  useEffect(() => {
    if (!ready) return;
    let active = true;
    getBlogPost(postId).then(
      (value) => {
        if (!active) return;
        setPost(value);
        setMissing(false);
      },
      () => active && setMissing(true),
    );
    return () => {
      active = false;
    };
  }, [postId, ready, userId]);

  return (
    <Sheet as="article" className="community-sheet">
      <BackLink href={routes.blog}>모든 글</BackLink>
      <header className="community-article-head">
        <h2>{missing ? '글을 찾을 수 없습니다' : post?.title}</h2>
        {post && !missing && (
          <>
            <p className="community-meta">
              <span>{formatDate(post.createdAt)}</span>
              {post.updatedAt.slice(0, 10) !== post.createdAt.slice(0, 10) && <span>{formatDate(post.updatedAt)} 고침</span>}
              <VisibilityStamp visibility={post.visibility} locked={post.locked} />
            </p>
            <BlogPostActions postId={post.id} onStatus={setStatus} />
          </>
        )}
      </header>
      {missing ? (
        <div className="community-body">지워졌거나 지금은 읽을 수 없는 글입니다.</div>
      ) : post?.locked ? (
        <BlogLock postId={post.id} request={post.request} onRequested={(request) => setPost((value) => value && { ...value, request })} />
      ) : (
        <div className="community-body">{post?.body}</div>
      )}
      <FormStatus status={status} />
    </Sheet>
  );
}
