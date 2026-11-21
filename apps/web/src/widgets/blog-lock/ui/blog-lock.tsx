'use client';

import { useRef, useState } from 'react';
import { keepPhrases, prefersReducedMotion } from '@shared/lib';
import { ProofPad, type ProofRecord } from '@features/prove-theorem';
import { RequestAccess } from '@features/request-blog-access';
import type { AccessRequestState } from '@entities/blog-post';
import { SurrenderDialog } from './surrender-dialog';
import './blog-lock.css';

interface BlogLockProps {
  postId: string;
  request: AccessRequestState | null;
  onRequested: (request: AccessRequestState) => void;
}

/** 허락받지 못한 사람에게 본문 대신 보이는 것: 풀 수 없는 문제와 메모장, 그 아래 주인장에게 요청하기 */
export function BlogLock({ postId, request, onRequested }: BlogLockProps) {
  const lockRef = useRef<HTMLDivElement>(null);
  // 문제를 끝까지 넘기면 항복 문서를 띄움. round 를 올리면 문제지가 처음 문제부터 다시 시작함
  const [surrender, setSurrender] = useState<ProofRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);

  function giveUp(record: ProofRecord) {
    setSurrender(record);
    setOpen(true);
  }

  function restart() {
    setOpen(false);
    setRound((value) => value + 1);
    lockRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div ref={lockRef} className="blog-lock">
      <p className="blog-lock-seal" aria-hidden="true">
        봉인
      </p>
      <p className="blog-lock-lead">
        <span>{keepPhrases('이 글은 주인장이 허락한 사람만 읽을 수 있습니다.')}</span>
        <span>{keepPhrases('그러나 아래 문제를 풀면 주인장의 허락 없이도 볼 수 있을지도...?')}</span>
      </p>
      <ProofPad key={round} postId={postId} onGiveUp={giveUp} />
      <RequestAccess postId={postId} request={request} onRequested={onRequested} />
      {surrender && (
        <SurrenderDialog
          open={open}
          record={surrender}
          postId={postId}
          request={request}
          onRequested={onRequested}
          onClose={() => setOpen(false)}
          onRestart={restart}
        />
      )}
    </div>
  );
}
