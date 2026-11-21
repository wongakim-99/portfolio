import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountMenu } from '@widgets/account-menu';
import { BlogHeader } from '@widgets/blog-header';
import { SiteFooter } from '@widgets/site-footer';
import { SiteHeader } from '@widgets/site-header';
import { AuthDialog } from '@features/auth';
import { SessionProvider } from '@entities/user';
import '@shared/styles/community.css';

export const metadata: Metadata = {
  title: '블로그',
  description: '김가원의 블로그. 기술 글은 누구나 읽고, 잠긴 글은 주인장에게 허락받거나 밀레니엄 문제를 풀면 읽을 수 있습니다.',
  referrer: 'no-referrer',
};

// 블로그 화면(/blog/*)이 같이 쓰는 틀. 로그인은 피드 계정을 그대로 씀
export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SiteHeader account={<AccountMenu />} />
      <main className="community-main" id="main">
        <BlogHeader />
        {children}
      </main>
      <SiteFooter />
      <AuthDialog />
    </SessionProvider>
  );
}
