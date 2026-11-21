import Link from 'next/link';
import type { ReactNode } from 'react';
import { routes } from '@shared/config';
import './site-footer.css';

interface SiteFooterProps {
  /** 저작권 줄 끝에 붙는 글. 홈은 방문 수를 붙임 */
  note?: ReactNode;
  /** 오른쪽 칸. 없으면 홈으로 돌아가는 링크 */
  children?: ReactNode;
}

export function SiteFooter({ note, children }: SiteFooterProps) {
  return (
    <footer className="footer">
      <p>
        &copy; 2026 김가원 <span className="sep">/</span> 집에 있는 노트북에서 운영 중{note}
      </p>
      {children ?? <Link href={routes.home}>홈으로 돌아가기</Link>}
    </footer>
  );
}
