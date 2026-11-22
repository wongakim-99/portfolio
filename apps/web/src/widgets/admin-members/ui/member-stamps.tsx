import type { Member } from '@entities/user';

const ROLE_STAMP = { owner: '주인장', admin: '운영자' } as const;

/** 회원 페이지와 같은 이름의 역할 도장과 확인 대기 도장. 일반 회원은 아무것도 찍지 않음 */
export function MemberStamps({ member }: { member: Member }) {
  const role = member.role === 'member' ? null : ROLE_STAMP[member.role];
  if (!role && member.verifiedAt) return null;
  return (
    <span className="member-stamps">
      {role && <span className="member-stamp">{role}</span>}
      {!member.verifiedAt && <span className="member-stamp is-pending">확인 대기</span>}
    </span>
  );
}
