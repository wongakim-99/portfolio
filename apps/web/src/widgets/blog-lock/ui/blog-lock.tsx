'use client';

import { useRef } from 'react';
import { prefersReducedMotion } from '@shared/lib';
import { ProofPad } from '@features/prove-theorem';
import { RequestAccess } from '@features/request-blog-access';
import type { AccessRequestState } from '@entities/blog-post';
import './blog-lock.css';

interface BlogLockProps {
  postId: string;
  request: AccessRequestState | null;
  onRequested: (request: AccessRequestState) => void;
}

/** 허락받지 못한 사람에게 본문 대신 보이는 것: 풀 수 없는 문제와 메모장, 그 아래 주인장에게 요청하기 */
export function BlogLock({ postId, request, onRequested }: BlogLockProps) {
  const requestRef = useRef<HTMLElement>(null);

  function giveUp() {
    const section = requestRef.current;
    if (!section) return;
    section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }

  return (
    <div className="blog-lock">
      <p className="blog-lock-seal" aria-hidden="true">
        봉인
      </p>
      <p className="blog-lock-lead">이 글은 주인장이 허락한 분만 읽을 수 있습니다. 아니면 아래 문제를 풀어 주세요.</p>
      <ProofPad postId={postId} onGiveUp={giveUp} />
      <RequestAccess ref={requestRef} postId={postId} request={request} onRequested={onRequested} />
    </div>
  );
}
