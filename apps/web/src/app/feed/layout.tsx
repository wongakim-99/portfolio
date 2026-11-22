import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountMenu } from '@widgets/account-menu';
import { SiteFooter } from '@widgets/site-footer';
import { SiteHeader } from '@widgets/site-header';
import { AuthDialog, MailLinkDialogs } from '@features/auth';
import { SessionProvider } from '@entities/user';
import '@shared/styles/community.css';

export const metadata: Metadata = {
  title: '피드',
  description: '김가원의 포트폴리오 피드. 긴 글을 읽고, 로그인해서 글과 댓글을 남기고 내 페이지를 꾸밀 수 있습니다.',
  // 회원이 쓴 글에서 나가는 링크에 피드 주소를 남기지 않음
  referrer: 'no-referrer',
};

// 피드 화면(/feed/*)과 관리실이 같이 쓰는 틀. 로그인 상태는 여기서 한 번 확인하고 아래 화면들이 나눠 씀
// 피드 머리는 (board)/layout.tsx 에 있음
export default function FeedLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SiteHeader account={<AccountMenu />} />
      <main className="community-main" id="main">
        {children}
      </main>
      <SiteFooter />
      <AuthDialog />
      <MailLinkDialogs />
    </SessionProvider>
  );
}
