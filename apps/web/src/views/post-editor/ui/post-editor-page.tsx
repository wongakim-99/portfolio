'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { BackLink, Sheet, type Status } from '@shared/ui';
import { PostForm, type PostEdit } from '@features/write-post';
import { getPost } from '@entities/post';
import { useSession } from '@entities/user';
import './post-editor-page.css';

/** 내 글 고치기. 새 글은 피드 맨 위 쓰기 칸에서 씀 */
export function PostEditorPage({ postId }: { postId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready, requestLogin } = useSession();
  const [loaded, setLoaded] = useState<PostEdit | null>(null);
  const [loadStatus, setLoadStatus] = useState<Status | undefined>(undefined);
  const userId = user?.id;

  // 로그인 확인이 끝났는데 로그인 전이면 로그인 창을 띄우고, 로그인하면 이 화면으로 돌아옴
  useEffect(() => {
    if (ready && !userId) requestLogin(pathname);
  }, [ready, userId, pathname, requestLogin]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getPost(postId).then(
      (post) => {
        if (!active) return;
        // 남의 글은 고칠 수 없으니 읽기 화면으로 돌려보냄
        if (post.authorId !== userId) router.replace(routes.post(postId));
        else setLoaded({ title: post.title, body: post.body, photos: post.photos.map((photo) => photo.file), link: post.link?.url ?? '' });
      },
      () => active && setLoadStatus({ message: '글을 불러오지 못했습니다.', tone: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [postId, userId, router]);

  // 불러오는 중, 다 받은 뒤마다 폼을 새로 그려 처음 값을 다시 넣음
  const stage = !userId ? 'signed-out' : loaded ? 'loaded' : loadStatus ? 'failed' : 'loading';
  return (
    <Sheet className="community-sheet editor-sheet" aria-labelledby="editor-title">
      <BackLink href={routes.post(postId)}>글로 돌아가기</BackLink>
      <h2 id="editor-title">글 수정하기</h2>
      <p className="community-meta">
        {loaded?.title ? '예전에 쓴 긴 글은 제목과 본문을 그대로 고칩니다.' : '글은 500자까지 쓰고, 링크는 아래 칸에 따로 넣습니다. 붙인 사진은 그대로 둡니다.'}
      </p>
      <PostForm key={stage} postId={postId} initial={loaded ?? undefined} disabled={stage !== 'loaded'} initialStatus={loadStatus} />
    </Sheet>
  );
}
