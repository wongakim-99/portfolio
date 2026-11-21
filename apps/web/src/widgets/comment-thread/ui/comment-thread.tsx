'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormStatus, type Status } from '@shared/ui';
import { CommentForm } from '@features/write-comment';
import { listComments, type Comment } from '@entities/comment';
import type { ReportTarget } from '@entities/report';
import { useSession } from '@entities/user';
import { CommentItem } from './comment-item';
import './comment-thread.css';

interface CommentThreadProps {
  postId: string;
  /** 댓글을 달거나 지우면 글 머리의 댓글 수를 같이 바꿈 */
  onCountChange: (delta: number) => void;
  onReport: (target: ReportTarget) => void;
  /** 글 머리의 수정, 삭제 결과도 이 칸 아래에 보여 줌 */
  status: Status;
  onStatus: (status: Status) => void;
}

export function CommentThread({ postId, onCountChange, onReport, status, onStatus }: CommentThreadProps) {
  const { user, requestLogin } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 처음부터 다시 받거나(after 없음) 마지막 댓글 뒤를 이어 받음
  const load = useCallback(
    (after: string | null) =>
      listComments(postId, after).then(
        (page) => {
          setComments((prev) => (after ? [...prev, ...page.comments] : page.comments));
          setCursor(page.nextCursor);
          setLoaded(true);
        },
        () => onStatus({ message: '댓글을 불러오지 못했습니다. 다시 시도해 주세요.', tone: 'error' }),
      ),
    [postId, onStatus],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  return (
    <section className="community-comments" aria-labelledby="comments-title">
      <h3 id="comments-title">댓글</h3>
      <div aria-live="polite">
        {loaded && !comments.length && <p className="community-empty">아직 댓글이 없습니다.</p>}
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onChanged={(next) => setComments((list) => list.map((item) => (item.id === next.id ? next : item)))}
            onDeleted={() => {
              setComments((list) => list.filter((item) => item.id !== comment.id));
              onCountChange(-1);
            }}
            onReport={onReport}
            onStatus={onStatus}
          />
        ))}
      </div>
      {cursor && (
        <button className="text-btn community-more" type="button" onClick={() => load(cursor)}>
          댓글 더 보기
        </button>
      )}
      {user ? (
        <CommentForm
          postId={postId}
          onStatus={onStatus}
          onCreated={() => {
            onCountChange(1);
            load(null);
          }}
        />
      ) : (
        <p className="community-empty">
          댓글을 쓰려면 로그인해 주세요.{' '}
          <button className="text-btn" type="button" onClick={() => requestLogin()}>
            로그인 / 가입
          </button>
        </p>
      )}
      <FormStatus status={status} />
    </section>
  );
}
