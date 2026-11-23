'use client';

import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { cx, formatAgo, formatDateTime } from '@shared/lib';
import { ActionButton, RichText, YoutubeCard, type Status } from '@shared/ui';
import { LikeButton } from '@features/like-content';
import { COMMENT_LIMITS, deleteComment, deleteCommentAsAdmin, updateComment, type Comment } from '@entities/comment';
import type { ReportTarget } from '@entities/report';
import { AuthorLink, useSession } from '@entities/user';

interface CommentItemProps {
  comment: Comment;
  /** 글쓴이가 단 답글에 '글쓴이' 표시를 붙임 */
  postAuthorId: string;
  onChanged: (comment: Comment) => void;
  onDeleted: () => void;
  onReply: () => void;
  onReport: (target: ReportTarget) => void;
  onStatus: (status: Status) => void;
}

/** 답글 하나. 하트와 '답글' 단추, 내 답글이면 그 자리에서 고치거나 지움. 남의 답글이면 신고, 관리자면 관리자 삭제까지 */
export function CommentItem({ comment, postAuthorId, onChanged, onDeleted, onReply, onReport, onStatus }: CommentItemProps) {
  const { user, can, requestLogin } = useSession();
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
      const { comment: saved } = await updateComment(comment.id, body);
      onChanged({ ...comment, body: saved.body, video: saved.video });
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
    <article className={cx('community-comment', comment.parentId && 'is-nested')}>
      <p className="community-meta comment-head">
        <AuthorLink authorId={comment.authorId} authorName={comment.authorName} authorAvatarUrl={comment.authorAvatarUrl} />
        {comment.authorId === postAuthorId && <span className="comment-badge">글쓴이</span>}
        <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
          {formatAgo(comment.createdAt)}
        </time>
      </p>
      <div className="comment-body">
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
          <>
            {comment.replyToName && <span className="comment-to">@{comment.replyToName}</span>}
            <RichText className="comment-text" text={comment.body} />
            {comment.video && <YoutubeCard video={comment.video} compact />}
          </>
        )}
        <div className="comment-actions">
          <LikeButton target="comment" id={comment.id} likeCount={comment.likeCount} liked={comment.liked} onError={(message) => onStatus({ message, tone: 'error' })} />
          <button className="comment-reply" type="button" onClick={() => (user ? onReply() : requestLogin())}>
            답글
          </button>
          <span className="community-inline-actions action-row">
            {mine ? (
              <>
                <ActionButton icon="edit" size="sm" onClick={() => setEditing(true)}>
                  수정
                </ActionButton>
                <ActionButton
                  icon="delete"
                  size="sm"
                  tone="danger"
                  onClick={() => remove(comment.parentId ? '이 답글을 삭제할까요?' : '이 답글과 아래 이어진 답글을 삭제할까요?', () => deleteComment(comment.id))}
                >
                  삭제
                </ActionButton>
              </>
            ) : (
              <>
                <ActionButton icon="report" size="sm" onClick={() => onReport({ targetType: 'comment', targetId: comment.id })}>
                  신고
                </ActionButton>
                {can('content:moderate') && (
                  <ActionButton icon="delete" size="sm" tone="danger" onClick={() => remove('관리자 권한으로 이 답글을 삭제할까요?', () => deleteCommentAsAdmin(comment.id))}>
                    관리자 삭제
                  </ActionButton>
                )}
              </>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
