'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { BackLink, Sheet, type Status } from '@shared/ui';
import { BlogPostForm } from '@features/write-blog-post';
import { getBlogPost, type BlogPostInput } from '@entities/blog-post';
import { useSession } from '@entities/user';
import './blog-editor-page.css';

/** postId 가 있으면 글 고치기, 없으면 새 글. 주인장(blog:write)만 씀 */
export function BlogEditorPage({ postId }: { postId?: string }) {
  const pathname = usePathname();
  const { user, ready, can, requestLogin } = useSession();
  const [loaded, setLoaded] = useState<BlogPostInput | null>(null);
  const [loadStatus, setLoadStatus] = useState<Status | undefined>(undefined);
  const userId = user?.id;
  const owner = can('blog:write');

  useEffect(() => {
    if (ready && !userId) requestLogin(pathname);
  }, [ready, userId, pathname, requestLogin]);

  useEffect(() => {
    if (!owner || !postId) return;
    let active = true;
    getBlogPost(postId).then(
      (post) => active && setLoaded({ title: post.title, body: post.body ?? '', visibility: post.visibility }),
      () => active && setLoadStatus({ message: '글을 불러오지 못했습니다.', tone: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [postId, owner]);

  // 로그인 확인 전, 불러오는 중, 다 받은 뒤마다 폼을 새로 그려 처음 값을 다시 넣음
  const stage = !owner ? 'not-owner' : !postId ? 'draft' : loaded ? 'loaded' : loadStatus ? 'failed' : 'loading';
  return (
    <Sheet className="community-sheet blog-editor-sheet" aria-labelledby="blog-editor-title">
      <BackLink href={postId ? routes.blogPost(postId) : routes.blog}>{postId ? '글로 돌아가기' : '모든 글'}</BackLink>
      <h2 id="blog-editor-title">{postId ? '글 고치기' : '새 글 쓰기'}</h2>
      <p className="community-meta">
        {user && !owner ? '블로그 글은 주인장만 쓸 수 있습니다. 대신 피드에 써 보세요.' : '글마다 누가 읽을지 고를 수 있습니다. 줄바꿈은 쓴 그대로 보입니다.'}
      </p>
      <BlogPostForm
        key={stage}
        postId={postId}
        initial={loaded ?? undefined}
        restoreDraft={stage === 'draft'}
        disabled={stage !== 'draft' && stage !== 'loaded'}
        initialStatus={loadStatus}
      />
    </Sheet>
  );
}
