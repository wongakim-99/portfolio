'use client';

import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { formatDate } from '@shared/lib';
import { ActionButton, type Status } from '@shared/ui';
import { COMMENT_LIMITS, deleteComment, deleteCommentAsAdmin, updateComment, type Comment } from '@entities/comment';
import type { ReportTarget } from '@entities/report';
import { AuthorLink, useSession } from '@entities/user';

interface CommentItemProps {
  comment: Comment;
  onChanged: (comment: Comment) => void;
  onDeleted: () => void;
  onReport: (target: ReportTarget) => void;
  onStatus: (status: Status) => void;
}

/** 내 댓글이면 그 자리에서 고치거나 지움. 남의 댓글이면 신고, 관리자면 관리자 삭제까지 */
export function CommentItem({ comment, onChanged, onDeleted, onReport, onStatus }: CommentItemProps) {
  const { user, can } = useSession();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const mine = user?.id === comment.authorId;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const body = String(new FormData(form).get('body'));
    setSaving(true);
    try {
      await updateComment(comment.id, body);
      onChanged({ ...comment, body: body.trim() });
      setEditing(false);
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function remove(message: string, task: () => Promise<unknown>) {
    if (!confirm(message)) return;
    try {
      await task();
      onDeleted();
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    }
  }

  return (
    <article className="community-comment">
      <p className="community-meta">
        <AuthorLink authorId={comment.authorId} authorName={comment.authorName} authorAvatarUrl={comment.authorAvatarUrl} />
        <span>{formatDate(comment.createdAt)}</span>
      </p>
      {editing ? (
        <form className="community-form" onSubmit={save}>
          <textarea name="body" required minLength={COMMENT_LIMITS.min} maxLength={COMMENT_LIMITS.max} defaultValue={comment.body} autoFocus />
          <div className="community-inline-actions">
            <button className="tape" type="submit" disabled={saving}>
              저장
            </button>
            <button className="text-btn" type="button" onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </form>
      ) : (
        <p>{comment.body}</p>
      )}
      <div className="community-inline-actions action-row">
        {mine ? (
          <>
            <ActionButton icon="edit" size="sm" onClick={() => setEditing(true)}>
              수정
            </ActionButton>
            <ActionButton icon="delete" size="sm" tone="danger" onClick={() => remove('이 댓글을 삭제할까요?', () => deleteComment(comment.id))}>
              삭제
            </ActionButton>
          </>
        ) : (
          <>
            <ActionButton icon="report" size="sm" onClick={() => onReport({ targetType: 'comment', targetId: comment.id })}>
              신고
            </ActionButton>
            {can('content:moderate') && (
              <ActionButton icon="delete" size="sm" tone="danger" onClick={() => remove('관리자 권한으로 이 댓글을 삭제할까요?', () => deleteCommentAsAdmin(comment.id))}>
                관리자 삭제
              </ActionButton>
            )}
          </>
        )}
      </div>
    </article>
  );
}
