'use client';

import { useRouter } from 'next/navigation';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { ActionButton, type Status } from '@shared/ui';
import { deletePost, deletePostAsAdmin, type Post } from '@entities/post';
import type { ReportTarget } from '@entities/report';
import { useSession } from '@entities/user';

interface PostActionsProps {
  post: Post;
  onReport: (target: ReportTarget) => void;
  onStatus: (status: Status) => void;
}

/** 글 머리의 버튼. 내 글이면 수정, 삭제. 남의 글이면 신고, 관리자면 관리자 삭제까지 */
export function PostActions({ post, onReport, onStatus }: PostActionsProps) {
  const router = useRouter();
  const { user, can } = useSession();

  async function remove(message: string, task: () => Promise<unknown>) {
    if (!confirm(message)) return;
    try {
      await task();
      router.push(routes.feed);
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    }
  }

  if (user?.id === post.authorId) {
    return (
      <div className="community-inline-actions action-row">
        <ActionButton icon="edit" onClick={() => router.push(routes.editPost(post.id))}>
          수정
        </ActionButton>
        <ActionButton icon="delete" tone="danger" onClick={() => remove('이 글과 댓글을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.', () => deletePost(post.id))}>
          삭제
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="community-inline-actions action-row">
      <ActionButton icon="report" onClick={() => onReport({ targetType: 'post', targetId: post.id })}>
        신고
      </ActionButton>
      {can('content:moderate') && (
        <ActionButton
          icon="delete"
          tone="danger"
          onClick={() => remove('관리자 권한으로 이 글과 댓글을 삭제할까요? 되돌릴 수 없습니다.', () => deletePostAsAdmin(post.id))}
        >
          관리자 삭제
        </ActionButton>
      )}
    </div>
  );
}
