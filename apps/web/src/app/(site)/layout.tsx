import type { ReactNode } from 'react';
import { SiteHeader } from '@widgets/site-header';

// 홈과 포트폴리오. 상단에는 페이지 탭과 스탠드만 있음
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
