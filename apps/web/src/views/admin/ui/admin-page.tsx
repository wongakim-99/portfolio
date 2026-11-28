'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { routes } from '@shared/config';
import { prefersReducedMotion, useDocumentTitle } from '@shared/lib';
import { BackLink, FormStatus, NO_STATUS, Sheet, type Status } from '@shared/ui';
import { AdminBlogAccess } from '@widgets/admin-blog-access';
import { AdminBlogRooms } from '@widgets/admin-blog-rooms';
import { AdminGuard } from '@widgets/admin-guard';
import { AdminInbox } from '@widgets/admin-inbox';
import { AdminMembers } from '@widgets/admin-members';
import { AdminReports } from '@widgets/admin-reports';
import { ServerConsole } from '@widgets/server-console';
import { ServerTopology } from '@widgets/server-topology';
import { listAccessRequests } from '@entities/blog-access';
import { getRoomOverview } from '@entities/blog-post';
import { getAdminSummary, setUnreadMessages, useUnreadMessages } from '@entities/message';
import { useSession, type Permission } from '@entities/user';
import { replaceHash, useHash } from '../model/use-hash';
import { AdminNav } from './admin-nav';
import './admin-page.css';

type SectionKey = 'server' | 'guard' | 'members' | 'blog-rooms' | 'blog-requests' | 'inbox' | 'reports';

// 관리실 칸. 칸마다 권한이 따로 있어서 가진 권한의 칸만 보임. 실제 허용 여부는 API 가 요청마다 다시 확인함
const SECTIONS: { key: SectionKey; label: string; permission: Permission }[] = [
  { key: 'server', label: '서버 상태', permission: 'server:read' },
  { key: 'guard', label: '이상 징후', permission: 'server:read' },
  { key: 'members', label: '회원', permission: 'members:read' },
  { key: 'blog-rooms', label: '블로그 방', permission: 'blog:write' },
  { key: 'blog-requests', label: '블로그 열람', permission: 'blog:grant' },
  { key: 'inbox', label: '쪽지함', permission: 'messages:read' },
  { key: 'reports', label: '신고', permission: 'reports:read' },
];

// 관리실. 한 번에 한 칸만 펼쳐서 페이지가 길어지지 않게 함. 고른 칸은 주소의 # 에 남음
export function AdminPage() {
  const { user, ready, can, requestLogin } = useSession();
  const [status, setStatus] = useState<Status>(NO_STATUS);
  // 칸에서 무언가를 처리하면 칸 이름 옆 숫자를 다시 셈
  const [changes, setChanges] = useState(0);
  const [counts, setCounts] = useState<{ reports?: number; requests?: number; unsorted?: number }>({});
  const unread = useUnreadMessages();
  const hash = useHash();
  const top = useRef<HTMLDivElement>(null);
  const userId = user?.id;
  useDocumentTitle('관리실 | 김가원 피드');

  useEffect(() => {
    if (ready && !userId) requestLogin(routes.admin);
  }, [ready, userId, requestLogin]);

  const canSummary = can('messages:read');
  const canGrant = can('blog:grant');
  const canWrite = can('blog:write');
  useEffect(() => {
    if (!userId) return;
    let active = true;
    // 숫자는 곁들이는 것이라 못 받아도 칸은 그대로 씀
    if (canSummary) {
      getAdminSummary().then(({ unreadMessages, reports }) => {
        if (!active) return;
        setUnreadMessages(unreadMessages);
        setCounts((value) => ({ ...value, reports }));
      }, () => {});
    }
    if (canGrant) listAccessRequests().then(({ requests }) => active && setCounts((value) => ({ ...value, requests: requests.length })), () => {});
    // 방 칸 옆 숫자는 아직 방이 없는 글 수
    if (canWrite) getRoomOverview().then(({ unsorted }) => active && setCounts((value) => ({ ...value, unsorted })), () => {});
    return () => {
      active = false;
    };
  }, [userId, canSummary, canGrant, canWrite, changes]);

  const report = useCallback((next: Status) => {
    setStatus(next);
    setChanges((value) => value + 1);
  }, []);

  const sections = SECTIONS.filter((section) => can(section.permission));
  const active = sections.find((section) => section.key === hash)?.key ?? sections[0]?.key;
  const badges: Partial<Record<SectionKey, number>> = { inbox: unread, reports: counts.reports, 'blog-requests': counts.requests, 'blog-rooms': counts.unsorted };

  function select(key: string) {
    replaceHash(key);
    setStatus(NO_STATUS);
    // 아래로 내려 읽다가 칸을 바꾸면 새 칸의 맨 위(좁은 화면은 탭)부터 보이게 올림
    const box = top.current;
    if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div ref={top} className="admin-layout">
      {user && active && (
        <AdminNav
          items={sections.map((section) => ({ key: section.key, label: section.label, badge: badges[section.key] }))}
          active={active}
          onSelect={select}
        />
      )}
      <Sheet className="community-sheet admin-sheet" aria-labelledby="admin-title">
        <BackLink href={routes.feed}>모든 글</BackLink>
        <p className="hand profile-hand">운영자에게만 보이는 곳</p>
        <h1 id="admin-title">관리실</h1>
        <p className="community-meta admin-lead">
          {user && !active ? '관리자 권한이 있는 계정만 볼 수 있습니다.' : '지금 서버 상태와 봇 방어, 회원, 블로그 방과 열람, 홈 엽서로 받은 쪽지, 피드 신고를 봅니다.'}
        </p>
        {active === 'server' && <ServerConsole live={<ServerTopology />} />}
        {active === 'guard' && <AdminGuard onStatus={report} />}
        {active === 'members' && <AdminMembers />}
        {active === 'blog-rooms' && <AdminBlogRooms onStatus={report} />}
        {active === 'blog-requests' && <AdminBlogAccess onStatus={report} />}
        {active === 'inbox' && <AdminInbox onStatus={report} />}
        {active === 'reports' && <AdminReports onStatus={report} />}
        <FormStatus status={status} />
      </Sheet>
    </div>
  );
}
