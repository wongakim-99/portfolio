import Link from 'next/link';
import type { ReactNode } from 'react';
import { routes } from '@shared/config';
import { TerminalButton } from '@features/open-terminal';
import { LampButton } from '@features/theme-toggle';
import { SiteNav } from './site-nav';
import './site-header.css';

/** account 는 app 레이어가 넣는 계정 칸(로그인, 관리실, 내 페이지, 로그아웃). 위젯끼리는 서로 부르지 않아서 밖에서 받음 */
export function SiteHeader({ account }: { account?: ReactNode }) {
  return (
    <header className="topbar">
      <Link className="tape brand" href={routes.home}>
        gawon-dev
      </Link>
      <SiteNav />
      {account}
      <div className="topbar-tools">
        <TerminalButton />
        <LampButton />
      </div>
    </header>
  );
}
