'use client';

import { useState } from 'react';
import { errorMessage } from '@shared/api';
import { cx, formatNumber } from '@shared/lib';
import { likeComment } from '@entities/comment';
import { likePost } from '@entities/post';
import { useSession } from '@entities/user';
import './like-button.css';

interface LikeButtonProps {
  target: 'post' | 'comment';
  id: string;
  likeCount: number;
  liked: boolean;
  /** 실패했을 때 알릴 곳 */
  onError?: (message: string) => void;
}

/** 하트. 누르면 먼저 바꿔 보여 주고 서버 결과로 맞춤. 실패하면 되돌림. 로그인 전이면 로그인 창부터 */
export function LikeButton({ target, id, likeCount, liked, onError }: LikeButtonProps) {
  const { user, requestLogin } = useSession();
  const [state, setState] = useState({ count: likeCount, liked });
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!user) return requestLogin();
    if (busy) return;
    const next = !state.liked;
    const before = state;
    setState({ count: Math.max(0, state.count + (next ? 1 : -1)), liked: next });
    setBusy(true);
    try {
      const saved = await (target === 'post' ? likePost(id, next) : likeComment(id, next));
      setState({ count: saved.likeCount, liked: saved.liked });
    } catch (error) {
      setState(before);
      onError?.(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={cx('like-btn', state.liked && 'is-on')}
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? '좋아요 거두기' : '좋아요'}
      onClick={toggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-9.3-9.1C1.5 8.3 3.4 4.8 6.9 4.5c2.1-.2 3.8 1 5.1 2.8 1.3-1.8 3-3 5.1-2.8 3.5.3 5.4 3.8 4.2 6.9-1.8 4.5-9.3 9.1-9.3 9.1Z" />
      </svg>
      <span>{state.count ? formatNumber(state.count) : ''}</span>
    </button>
  );
}
