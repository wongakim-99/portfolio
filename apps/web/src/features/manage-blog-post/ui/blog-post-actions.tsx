'use client';

import { useRouter } from 'next/navigation';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { ActionButton, type Status } from '@shared/ui';
import { deleteBlogPost } from '@entities/blog-post';
import { useSession } from '@entities/user';

/** 글 머리의 고치기, 지우기. 주인장(blog:write)에게만 보임 */
export function BlogPostActions({ postId, onStatus }: { postId: string; onStatus: (status: Status) => void }) {
  const router = useRouter();
  const { can } = useSession();
  if (!can('blog:write')) return null;

  async function remove() {
    if (!confirm('이 글을 지울까요? 이 글에 온 요청과 허락도 같이 지워지고 되돌릴 수 없습니다.')) return;
    try {
      await deleteBlogPost(postId);
      router.push(routes.blog);
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    }
  }

  return (
    <div className="community-inline-actions action-row">
      <ActionButton icon="edit" onClick={() => router.push(routes.editBlogPost(postId))}>
        고치기
      </ActionButton>
      <ActionButton icon="delete" tone="danger" onClick={remove}>
        지우기
      </ActionButton>
    </div>
  );
}
