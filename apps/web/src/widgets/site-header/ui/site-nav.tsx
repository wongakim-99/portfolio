'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routes } from '@shared/config';

const PAGES = [
  { href: routes.home, label: '홈' },
  { href: routes.portfolio, label: '포트폴리오' },
  { href: routes.blog, label: '블로그' },
  { href: routes.feed, label: '피드' },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  // 피드 안의 글, 회원 페이지에서도 피드 탭을 켜 둠. 블로그 글 화면에서는 블로그 탭
  // 관리실은 주소만 /feed 아래라 피드 탭을 끄고, 계정 칸의 관리실 단추가 켜짐
  const current = (href: string) => {
    if (href === routes.home) return pathname === href;
    if (pathname === routes.admin) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  return (
    <nav className="topnav" aria-label="페이지">
      {PAGES.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={current(href) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
