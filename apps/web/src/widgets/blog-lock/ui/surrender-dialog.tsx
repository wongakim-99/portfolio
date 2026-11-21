'use client';

import { useId } from 'react';
import { keepPhrases } from '@shared/lib';
import { Dialog } from '@shared/ui';
import type { ProofRecord } from '@features/prove-theorem';
import { RequestAccess } from '@features/request-blog-access';
import type { AccessRequestState } from '@entities/blog-post';
import { useSession } from '@entities/user';

interface SurrenderDialogProps {
  open: boolean;
  record: ProofRecord;
  postId: string;
  request: AccessRequestState | null;
  onRequested: (request: AccessRequestState) => void;
  onClose: () => void;
  /** 처음 문제부터 다시 */
  onRestart: () => void;
}

/** 문제를 끝까지 다 넘기면 뜨는 이스터에그. 빨간 '항복' 도장이 찍힌 문서와 그 아래 주인장에게 요청하기 */
export function SurrenderDialog({ open, record, postId, request, onRequested, onClose, onRestart }: SurrenderDialogProps) {
  const titleId = useId();
  const { user } = useSession();
  const { attempts, problems } = record;

  return (
    <Dialog open={open} onClose={onClose} className="community-dialog surrender" labelledBy={titleId}>
      <div className="community-dialog-head">
        <h2 id={titleId}>항복 문서</h2>
        <button className="text-btn" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
      {/* 열릴 때마다 다시 찍히도록 open 일 때만 그림 */}
      {open && (
        <p className="surrender-stamp" aria-hidden="true">
          항복
        </p>
      )}
      <p className="hand surrender-hand">
        {keepPhrases(attempts === 0 ? '한 장도 안 내고 끝까지 넘기셨네요. 솔직해서 좋습니다.' : `문제 ${problems}개를 끝까지 다 넘기셨습니다.`)}
      </p>
      <p className="surrender-body">
        {keepPhrases(`본인은 밀레니엄 난제를 비롯한 문제 ${problems}개 가운데 하나도 풀지 못했음을 인정하고, 수학 대신 주인장의 너그러움에 기대기로 합니다.`)}
      </p>
      <dl className="surrender-record">
        <div>
          <dt>낸 증명</dt>
          <dd>{attempts}장</dd>
        </div>
        <div>
          <dt>통과</dt>
          <dd>0장</dd>
        </div>
        <div>
          <dt>넘긴 문제</dt>
          <dd>{problems}개</dd>
        </div>
      </dl>
      <p className="surrender-sign">
        서명 <span className="hand">{user?.name ?? '이름 모를 도전자'}</span>
      </p>
      <p className="surrender-foot">이 문서는 클레이 수학연구소에 보내지 않습니다.</p>

      <RequestAccess postId={postId} request={request} onRequested={onRequested} />

      <div className="surrender-actions">
        <button className="text-btn" type="button" onClick={onRestart}>
          처음 문제부터 다시 풀어 볼게요
        </button>
      </div>
    </Dialog>
  );
}
