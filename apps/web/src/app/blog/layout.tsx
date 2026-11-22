import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountMenu } from '@widgets/account-menu';
import { Rocky } from '@widgets/rocky';
import { SiteFooter } from '@widgets/site-footer';
import { SiteHeader } from '@widgets/site-header';
import '@shared/styles/blog.css';

export const metadata: Metadata = {
  title: '블로그',
  description: '김가원의 블로그. 기술 글은 누구나 읽고, 잠긴 글은 주인장에게 허락받거나 밀레니엄 문제를 풀면 읽을 수 있습니다.',
  referrer: 'no-referrer',
};

// 블로그 화면(/blog/*)이 같이 쓰는 틀. 로그인은 피드 계정을 그대로 씀(로그인 상태와 창은 app/layout.tsx). 피드와 달리 흰 페이지에 목록은 카드로 놓음 (shared/styles/blog.css)
export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader account={<AccountMenu />} />
      <main className="blog-main" id="main">
        {children}
      </main>
      <SiteFooter />
      {/* 빈 책상을 굴러다니는 로키 공 (이스터에그) */}
      <Rocky />
    </>
  );
}
