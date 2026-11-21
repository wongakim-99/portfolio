import Link from 'next/link';
import type { ReactNode } from 'react';
import './back-link.css';

/** 종이 위쪽의 돌아가기 버튼 (← 모든 글) */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="back-link" href={href}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 12H5" />
        <path d="m11 18-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}
