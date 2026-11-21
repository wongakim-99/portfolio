'use client';

import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { formatCount } from '@shared/lib';
import type { Status } from '@shared/ui';
import { COMMENT_LIMITS, createComment } from '@entities/comment';

interface CommentFormProps {
  postId: string;
  onCreated: () => void;
  /** 댓글 칸 아래 상태 문구는 글 머리의 수정, 삭제 결과와 같이 씀 */
  onStatus: (status: Status) => void;
}

export function CommentForm({ postId, onCreated, onStatus }: CommentFormProps) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    try {
      await createComment(postId, body);
      setBody('');
      onStatus({ message: '댓글을 등록했습니다.', tone: 'ok' });
      onCreated();
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="community-form comment-form" onSubmit={submit}>
      <label htmlFor="comment-body">댓글 남기기</label>
      <textarea
        id="comment-body"
        name="body"
        required
        minLength={COMMENT_LIMITS.min}
        maxLength={COMMENT_LIMITS.max}
        rows={4}
        placeholder="생각을 나눠 주세요"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="community-form-foot">
        <span>{formatCount(body.length, COMMENT_LIMITS.max)}</span>
        <button className="tape" type="submit" disabled={busy}>
          댓글 등록
        </button>
      </div>
    </form>
  );
}
