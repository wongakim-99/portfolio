'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { Sheet, type Status } from '@shared/ui';
import { PostForm } from '@features/write-post';
import { getPost, type PostDraft } from '@entities/post';
import { useSession } from '@entities/user';
import './post-editor-page.css';

/** postId 가 있으면 내 글 수정, 없으면 새 글 쓰기 */
export function PostEditorPage({ postId }: { postId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready, requestLogin } = useSession();
  const [loaded, setLoaded] = useState<PostDraft | null>(null);
  const [loadStatus, setLoadStatus] = useState<Status | undefined>(undefined);
  const userId = user?.id;

  // 로그인 확인이 끝났는데 로그인 전이면 로그인 창을 띄우고, 로그인하면 이 화면으로 돌아옴
  useEffect(() => {
    if (ready && !userId) requestLogin(pathname);
  }, [ready, userId, pathname, requestLogin]);

  useEffect(() => {
    if (!userId || !postId) return;
    let active = true;
    getPost(postId).then(
      (post) => {
        if (!active) return;
        // 남의 글은 고칠 수 없으니 읽기 화면으로 돌려보냄
        if (post.authorId !== userId) router.replace(routes.post(postId));
        else setLoaded({ title: post.title, body: post.body });
      },
      () => active && setLoadStatus({ message: '글을 불러오지 못했습니다.', tone: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [postId, userId, router]);

  // 로그인 확인 전, 불러오는 중, 다 받은 뒤마다 폼을 새로 그려 처음 값을 다시 넣음
  const stage = !userId ? 'signed-out' : !postId ? 'draft' : loaded ? 'loaded' : loadStatus ? 'failed' : 'loading';
  return (
    <Sheet className="community-sheet editor-sheet" aria-labelledby="editor-title">
      <Link className="community-back" href={routes.feed}>
        ← 모든 글
      </Link>
      <h2 id="editor-title">{postId ? '글 수정하기' : '새 글 쓰기'}</h2>
      <p className="community-meta">제목과 본문을 적어 주세요. 줄바꿈이 그대로 보입니다.</p>
      <PostForm
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
