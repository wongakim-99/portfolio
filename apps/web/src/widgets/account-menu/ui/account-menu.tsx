'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { routes } from '@shared/config';
import { useLogout } from '@features/auth';
import { getAdminSummary, setUnreadMessages, useUnreadMessages } from '@entities/message';
import { Avatar, useSession } from '@entities/user';
import './account-menu.css';

// 피드 상단 오른쪽 계정 칸. 로그인 전에는 로그인, 뒤에는 (관리자면) 관리실, 프로필 사진(내 페이지), 로그아웃
export function AccountMenu() {
  const pathname = usePathname();
  const { user, can, requestLogin } = useSession();
  const unread = useUnreadMessages();
  const logout = useLogout();
  const canReadMessages = can('messages:read');

  useEffect(() => {
    if (!canReadMessages) return;
    // 배지만 못 보여 줄 뿐 다른 화면에는 영향 없으니 실패는 넘어감
    getAdminSummary().then(({ unreadMessages }) => setUnreadMessages(unreadMessages), () => {});
  }, [canReadMessages]);

  const myPage = user ? routes.user(user.id) : null;
  return (
    <div className="topbar-account" aria-label="계정">
      {!user && (
        <button className="account-pill" type="button" onClick={() => requestLogin()}>
          로그인
        </button>
      )}
      {canReadMessages && (
        <Link
          className="account-pill account-admin"
          href={routes.admin}
          aria-current={pathname === routes.admin ? 'page' : undefined}
          aria-label={unread ? `관리실, 새 쪽지 ${unread}개` : '관리실'}
        >
          <svg className="account-admin-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="4" width="14" height="17" rx="2" />
            <path d="M9 2.5h6v3H9zM9 11h6M9 15h4" />
          </svg>
          <span className="account-admin-text">관리실</span>
          {unread > 0 && <span className="community-badge">{unread > 99 ? '99+' : unread}</span>}
        </Link>
      )}
      {user && myPage && (
        <>
          <Link className="account-avatar" href={myPage} title="내 페이지" aria-label={`내 페이지 (${user.name})`} aria-current={pathname === myPage ? 'page' : undefined}>
            <Avatar person={user} />
          </Link>
          <button className="account-pill account-logout" type="button" onClick={() => logout((message) => alert(message))}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h10" />
            </svg>
            <span className="account-logout-text">로그아웃</span>
          </button>
        </>
      )}
    </div>
  );
}
