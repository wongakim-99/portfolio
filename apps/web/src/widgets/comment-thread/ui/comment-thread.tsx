'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormStatus, type Status } from '@shared/ui';
import { CommentForm } from '@features/write-comment';
import { listComments, type Comment } from '@entities/comment';
import type { ReportTarget } from '@entities/report';
import { useSession } from '@entities/user';
import { CommentItem } from './comment-item';
import './comment-thread.css';

interface CommentThreadProps {
  postId: string;
  postAuthorId: string;
  /** 답글을 달거나 지우면 글 머리의 답글 수를 같이 바꿈 */
  onCountChange: (delta: number) => void;
  onReport: (target: ReportTarget) => void;
  /** 글 머리의 수정, 삭제 결과도 이 칸 아래에 보여 줌 */
  status: Status;
  onStatus: (status: Status) => void;
}

/**
 * 글 아래 답글 타래. 글에 바로 단 답글마다 한 타래이고, 그 답글에 단 답글은 타래 안에 들여 씀 (한 단계만)
 * 맨 위 칸은 글에 다는 답글, 답글마다 '답글' 을 누르면 그 타래 끝에 작은 칸이 열림
 */
export function CommentThread({ postId, postAuthorId, onCountChange, onReport, status, onStatus }: CommentThreadProps) {
  const { user, requestLogin } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  /** 답글 칸을 연 답글 */
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  // 처음부터 다시 받거나(after 없음) 마지막 답글 뒤를 이어 받음. 로그인이 바뀌면 좋아요 표시가 달라서 다시 받음
  const viewer = user?.id ?? null;
  const load = useCallback(
    (after: string | null) =>
      listComments(postId, after).then(
        (page) => {
          setComments((prev) => (after ? [...prev, ...page.comments] : page.comments));
          setCursor(page.nextCursor);
          setLoaded(true);
        },
        () => onStatus({ message: '답글을 불러오지 못했습니다. 다시 시도해 주세요.', tone: 'error' }),
      ),
    [postId, onStatus],
  );

  useEffect(() => {
    load(null);
  }, [load, viewer]);

  // 오래된 순서대로 받은 답글을 타래로 묶음. 첫 답글을 아직 못 받은 답글은 따로 한 타래로 둠
  const threads = useMemo(() => {
    const roots = new Set(comments.filter((comment) => !comment.parentId).map((comment) => comment.id));
    const children = new Map<string, Comment[]>();
    for (const comment of comments) {
      if (comment.parentId && roots.has(comment.parentId)) children.set(comment.parentId, [...(children.get(comment.parentId) ?? []), comment]);
    }
    return comments
      .filter((comment) => !comment.parentId || !roots.has(comment.parentId))
      .map((root) => ({ root, replies: children.get(root.id) ?? [] }));
  }, [comments]);

  const added = (comment: Comment) => {
    setComments((list) => [...list, comment]);
    setReplyTo(null);
    onCountChange(1);
  };

  const removed = (comment: Comment) => {
    const gone = new Set([comment.id, ...(comment.parentId ? [] : comments.filter((item) => item.parentId === comment.id).map((item) => item.id))]);
    setComments((list) => list.filter((item) => !gone.has(item.id)));
    onCountChange(-gone.size);
  };

  const item = (comment: Comment) => (
    <CommentItem
      key={`${viewer}-${comment.id}`}
      comment={comment}
      postAuthorId={postAuthorId}
      onChanged={(next) => setComments((list) => list.map((value) => (value.id === next.id ? next : value)))}
      onDeleted={() => removed(comment)}
      onReply={() => setReplyTo(comment)}
      onReport={onReport}
      onStatus={onStatus}
    />
  );

  return (
    <section className="community-comments" aria-labelledby="comments-title">
      <h3 id="comments-title">답글</h3>
      {user ? (
        <CommentForm postId={postId} onStatus={onStatus} onCreated={added} />
      ) : (
        <p className="community-empty">
          답글을 쓰려면 로그인해 주세요.{' '}
          <button className="text-btn" type="button" onClick={() => requestLogin()}>
            로그인 / 가입
          </button>
        </p>
      )}
      <FormStatus status={status} />
      <div className="comment-list" aria-live="polite">
        {loaded && !comments.length && <p className="community-empty">아직 답글이 없습니다. 첫 답글을 남겨 주세요.</p>}
        {threads.map(({ root, replies }) => {
          const open = replyTo && (replyTo.id === root.id || replyTo.parentId === root.id);
          return (
            <div key={root.id} className="comment-thread" data-replies={replies.length > 0 || open || undefined}>
              {item(root)}
              {(replies.length > 0 || open) && (
                <div className="comment-replies">
                  {replies.map(item)}
                  {open && (
                    <CommentForm
                      key={replyTo.id}
                      postId={postId}
                      parent={{ id: replyTo.id, authorName: replyTo.authorName }}
                      onStatus={onStatus}
                      onCreated={added}
                      onCancel={() => setReplyTo(null)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {cursor && (
        <button className="text-btn community-more" type="button" onClick={() => load(cursor)}>
          답글 더 보기
        </button>
      )}
    </section>
  );
}
