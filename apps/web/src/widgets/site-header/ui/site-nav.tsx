'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routes } from '@shared/config';

const PAGES = [
  { href: routes.home, label: '홈' },
  { href: routes.portfolio, label: '포트폴리오' },
  { href: routes.feed, label: '피드' },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  // 피드 안의 글, 회원 페이지, 관리실에서도 피드 탭을 켜 둠
  const current = (href: string) => (href === routes.home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
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
