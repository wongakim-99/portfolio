'use client';

import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { cx, formatCount } from '@shared/lib';
import type { Status } from '@shared/ui';
import { COMMENT_LIMITS, createComment, type Comment } from '@entities/comment';

interface CommentFormProps {
  postId: string;
  /** 답글에 다는 답글이면 그 답글과 글쓴이 이름 */
  parent?: { id: string; authorName: string };
  onCreated: (comment: Comment) => void;
  onCancel?: () => void;
  /** 답글 칸 아래 상태 문구는 글 머리의 수정, 삭제 결과와 같이 씀 */
  onStatus: (status: Status) => void;
}

/** 글에 다는 답글, 또는 답글에 다는 답글. 답글에 달 때는 타래 안에 작게 열림 */
export function CommentForm({ postId, parent, onCreated, onCancel, onStatus }: CommentFormProps) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const id = parent ? `reply-${parent.id}` : 'comment-body';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    try {
      const { comment } = await createComment(postId, body, parent?.id);
      setBody('');
      onStatus({ message: '답글을 남겼습니다.', tone: 'ok' });
      onCreated(comment);
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={cx('community-form comment-form', parent && 'is-reply')} onSubmit={submit}>
      <label htmlFor={id}>{parent ? `${parent.authorName} 님에게 답글` : '답글 남기기'}</label>
      <textarea
        id={id}
        name="body"
        required
        minLength={COMMENT_LIMITS.min}
        maxLength={COMMENT_LIMITS.max}
        rows={parent ? 2 : 3}
        placeholder={parent ? '이어서 이야기해 주세요' : '생각을 나눠 주세요. 유튜브 링크를 넣으면 미리보기가 붙어요'}
        value={body}
        autoFocus={Boolean(parent)}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="community-form-foot">
        <span>{formatCount(body.length, COMMENT_LIMITS.max)}</span>
        <span className="comment-form-buttons">
          {onCancel && (
            <button className="text-btn" type="button" onClick={onCancel}>
              취소
            </button>
          )}
          <button className="tape" type="submit" disabled={busy}>
            {parent ? '답글 달기' : '답글 남기기'}
          </button>
        </span>
      </div>
    </form>
  );
}
