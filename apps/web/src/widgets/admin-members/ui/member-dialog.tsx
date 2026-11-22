'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { routes } from '@shared/config';
import { formatDateTime } from '@shared/lib';
import { Dialog, FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { MemberRoleControl } from '@features/change-member-role';
import { Avatar, getProfile, type Member } from '@entities/user';
import { formatAgo } from '../lib/roster';
import { MemberStamps } from './member-stamps';

interface MemberDialogProps {
  member: Member;
  onClose: () => void;
  onChanged: (member: Member) => void;
}

/** 회원 한 사람의 자세한 정보. 피드 글, 댓글 수는 회원 페이지와 같은 API 로 따로 받음 */
export function MemberDialog({ member, onClose, onChanged }: MemberDialogProps) {
  const titleId = useId();
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [activity, setActivity] = useState<{ id: string; posts: number; comments: number } | null>(null);
  const verified = Boolean(member.verifiedAt);

  useEffect(() => {
    if (!verified) return;
    let active = true;
    getProfile(member.id).then(
      (profile) => active && setActivity({ id: profile.id, posts: profile.postCount, comments: profile.commentCount }),
      () => {},
    );
    return () => {
      active = false;
    };
  }, [member.id, verified]);

  const counts = activity?.id === member.id ? activity : null;

  return (
    <Dialog open onClose={onClose} className="community-dialog member-dialog" labelledBy={titleId}>
      <div className="community-dialog-head">
        <h2 id={titleId}>{member.name}</h2>
        <button className="text-btn" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
      <div className="member-card">
        <Avatar person={member} className="avatar member-card-avatar" />
        <div className="member-card-text">
          <MemberStamps member={member} />
          <a className="member-card-email" href={`mailto:${member.email}`}>
            {member.email}
          </a>
          {member.bio && <p>{member.bio}</p>}
        </div>
      </div>
      <dl className="member-facts">
        <div>
          <dt>가입</dt>
          <dd>{formatDateTime(member.createdAt)}</dd>
        </div>
        <div>
          <dt>가입 확인</dt>
          <dd>{member.verifiedAt ? formatDateTime(member.verifiedAt) : '메일 확인 전. 하루 안에 확인하지 않으면 지워집니다.'}</dd>
        </div>
        <div>
          <dt>마지막 로그인</dt>
          <dd>{member.lastLoginAt ? `${formatAgo(member.lastLoginAt)}, ${formatDateTime(member.lastLoginAt)}` : '기록 없음'}</dd>
        </div>
        <div>
          <dt>로그인해 둔 브라우저</dt>
          <dd>{member.activeSessions}개</dd>
        </div>
        {verified && (
          <div>
            <dt>피드</dt>
            <dd>{counts ? `글 ${counts.posts}개, 댓글 ${counts.comments}개` : '세는 중'}</dd>
          </div>
        )}
      </dl>
      {verified && (
        <Link className="member-page-link" href={routes.user(member.id)}>
          회원 페이지 보기
        </Link>
      )}
      <MemberRoleControl member={member} onChanged={onChanged} onStatus={setStatus} />
      <FormStatus status={status} />
    </Dialog>
  );
}
