'use client';

import { useState } from 'react';
import { errorMessage } from '@shared/api';
import type { Status } from '@shared/ui';
import { setMemberRole, useSession, type Member } from '@entities/user';
import './member-role-control.css';

interface MemberRoleControlProps {
  member: Member;
  onChanged: (member: Member) => void;
  onStatus: (status: Status) => void;
}

/** 회원을 관리자로 지정하거나 해제. 주인장(members:role)에게만 보이고, 실제 허용은 API 가 다시 확인함 */
export function MemberRoleControl({ member, onChanged, onStatus }: MemberRoleControlProps) {
  const { user, can } = useSession();
  const [busy, setBusy] = useState(false);
  if (!can('members:role')) return null;

  // 바꿀 수 없는 사람은 버튼 대신 이유를 적음
  const blocked =
    member.role === 'owner'
      ? '주인장의 역할은 바꿀 수 없습니다.'
      : member.id === user?.id
        ? '내 역할은 여기서 바꿀 수 없습니다.'
        : !member.verifiedAt
          ? '가입 확인을 마친 뒤에 지정할 수 있습니다.'
          : null;
  const next = member.role === 'admin' ? 'member' : 'admin';

  async function change() {
    const question =
      next === 'admin'
        ? `${member.name}님을 관리자로 지정할까요? 쪽지함, 신고 처리, 남의 글 삭제, 서버 상태, 회원 목록(이메일 포함)을 볼 수 있게 됩니다.`
        : `${member.name}님의 관리자 권한을 거둘까요? 이미 로그인한 창에서도 바로 사라집니다.`;
    if (!confirm(question)) return;
    setBusy(true);
    try {
      const { member: changed } = await setMemberRole(member.id, next);
      onChanged(changed);
      onStatus({ message: next === 'admin' ? `${changed.name}님을 관리자로 지정했습니다.` : `${changed.name}님의 관리자 권한을 거뒀습니다.`, tone: 'ok' });
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="member-role">
      <h4>역할</h4>
      {blocked ? (
        <p className="community-meta">{blocked}</p>
      ) : (
        <button className={next === 'admin' ? 'tape' : 'text-btn text-btn-danger'} type="button" onClick={change} disabled={busy}>
          {next === 'admin' ? '관리자로 지정' : '관리자 해제'}
        </button>
      )}
    </div>
  );
}
