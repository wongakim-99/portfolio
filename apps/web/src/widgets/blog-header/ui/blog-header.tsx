'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { listAccessRequests } from '@entities/blog-access';
import { useSession } from '@entities/user';
import './blog-header.css';

/** 블로그의 모든 화면 위에 늘 있는 머리. 주인장에게만 글 쓰기와 대기 중인 열람 요청 수가 보임 */
export function BlogHeader() {
  const { can } = useSession();
  const owner = can('blog:write');
  const canGrant = can('blog:grant');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!canGrant) return;
    // 숫자만 못 보여 줄 뿐이라 실패는 넘어감
    listAccessRequests().then(({ requests }) => setPending(requests.length), () => {});
  }, [canGrant]);

  return (
    <header className="community-header blog-header">
      <p className="hand community-hand">혼잣말과 공부한 것 사이 어딘가</p>
      <h1>블로그</h1>
      <p>
        기술 글은 누구나 읽을 수 있어요. <mark>잠긴 글</mark>은 주인장이 허락한 분만 읽는데, 문제를 풀어도 열린다는 소문이 있습니다.
      </p>
      {owner && (
        <div className="community-toolbar">
          <Link className="tape tape-lg" href={routes.blogWrite}>
            글 쓰기
          </Link>
          {canGrant && (
            <Link className="btn-line blog-requests" href={routes.blogRequests} aria-label={pending ? `열람 요청 ${pending}건` : '열람 요청'}>
              열람 요청
              {pending > 0 && <span className="blog-requests-count">{pending > 99 ? '99+' : pending}</span>}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
