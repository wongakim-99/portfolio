'use client';

import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { formatDate, useDocumentTitle } from '@shared/lib';
import { BackLink, FormStatus, NO_STATUS, Sheet, type Status } from '@shared/ui';
import { BlogLock } from '@widgets/blog-lock';
import { BlogOwnerCard } from '@widgets/blog-sidebar';
import { BlogPostActions } from '@features/manage-blog-post';
import { BlogMarkdown, getBlogPost, getBlogSummary, RoomLabel, TagList, VisibilityStamp, type BlogPost, type BlogSummary } from '@entities/blog-post';
import { useSession } from '@entities/user';
import './blog-post-page.css';

export function BlogPostPage({ postId }: { postId: string }) {
  const { user, ready } = useSession();
  const userId = user?.id ?? null;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [missing, setMissing] = useState(false);
  const [owner, setOwner] = useState<BlogSummary['owner']>(null);
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

  // 글쓴이 이름과 글 끝의 소개 카드. 못 받으면 빼고 보여 줌
  useEffect(() => {
    let active = true;
    getBlogSummary().then((value) => active && setOwner(value.owner), () => {});
    return () => {
      active = false;
    };
  }, []);

  const edited = post && post.updatedAt.slice(0, 10) !== post.createdAt.slice(0, 10);
  return (
    <Sheet as="article" className="blog-article">
      <BackLink href={routes.blog}>블로그</BackLink>
      {/* 따로 고른 표지만 맨 위에. 본문 첫 사진이 썸네일인 글은 본문에 이미 있으니 겹쳐 두지 않음 */}
      {post?.coverFile && post.cover && !missing && (
        <span className="blog-article-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.cover} alt="" decoding="async" />
        </span>
      )}
      <header className="blog-article-head">
        <h1>{missing ? '글을 찾을 수 없습니다' : post?.title}</h1>
        {post && !missing && (
          <>
            <div className="blog-article-meta">
              <p>
                <RoomLabel room={post.room} />
                {owner && <b>{owner.name}</b>}
                <span>{formatDate(post.createdAt)}</span>
                {edited && <span>{formatDate(post.updatedAt)} 고침</span>}
                {post.readMinutes && <span>{post.readMinutes}분 읽기</span>}
                <VisibilityStamp visibility={post.visibility} locked={post.locked} />
              </p>
              <BlogPostActions postId={post.id} onStatus={setStatus} />
            </div>
            <TagList tags={post.tags} />
          </>
        )}
      </header>
      {missing ? (
        <div className="blog-article-body">지워졌거나 지금은 읽을 수 없는 글입니다.</div>
      ) : post?.locked ? (
        <BlogLock postId={post.id} request={post.request} onRequested={(request) => setPost((value) => value && { ...value, request })} />
      ) : (
        <div className="blog-article-body">{post?.body && <BlogMarkdown source={post.body} />}</div>
      )}
      <FormStatus status={status} />
      {owner && post && !missing && (
        <footer className="blog-article-foot">
          <BlogOwnerCard owner={owner} />
        </footer>
      )}
    </Sheet>
  );
}
