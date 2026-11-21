import Link from 'next/link';
import type { ReactNode } from 'react';
import { routes } from '@shared/config';
import type { BlogSummary } from '@entities/blog-post';
import { Avatar } from '@entities/user';
import './blog-sidebar.css';

/** 블로그 주인 소개. 사이드바 맨 위와 글 끝에 같이 씀 */
export function BlogOwnerCard({ owner, children }: { owner: NonNullable<BlogSummary['owner']>; children?: ReactNode }) {
  return (
    <div className="blog-owner">
      <Avatar person={owner} className="avatar blog-owner-avatar" />
      <div className="blog-owner-text">
        <b>{owner.name}</b>
        <p>{owner.bio || '혼잣말과 공부한 것을 같이 적어 둡니다.'}</p>
        <Link className="blog-owner-link" href={routes.portfolio}>
          포트폴리오 보기
        </Link>
      </div>
      {children}
    </div>
  );
}
