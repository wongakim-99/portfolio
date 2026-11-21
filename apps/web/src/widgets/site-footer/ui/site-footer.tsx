import Link from 'next/link';
import type { ReactNode } from 'react';
import { routes } from '@shared/config';
import './site-footer.css';

interface SiteFooterProps {
  /** 저작권 줄 끝에 붙는 글. 홈은 방문 수를 붙임 */
  note?: ReactNode;
  /** 오른쪽의 '홈으로 돌아가기'. 홈에서는 뺌 */
  homeLink?: boolean;
}

export function SiteFooter({ note, homeLink = true }: SiteFooterProps) {
  return (
    <footer className="footer">
      <p>
        &copy; 2026 김가원 <span className="sep">/</span> 집에 있는 노트북에서 운영 중{note}
      </p>
      {homeLink && <Link href={routes.home}>홈으로 돌아가기</Link>}
    </footer>
  );
}
