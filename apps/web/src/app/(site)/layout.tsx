import type { ReactNode } from 'react';
import { AccountMenu } from '@widgets/account-menu';
import { SiteHeader } from '@widgets/site-header';

// 홈과 포트폴리오. 상단 바는 다른 화면과 같이 페이지 탭, 계정 칸, 터미널, 스탠드
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader account={<AccountMenu />} />
      {children}
    </>
  );
}
