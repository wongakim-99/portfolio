'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { cx } from '@shared/lib';
import { listAccessRequests } from '@entities/blog-access';
import { getBlogSummary, NO_ROOM, type BlogListQuery, type BlogSummary } from '@entities/blog-post';
import { useSession } from '@entities/user';
import { BlogOwnerCard } from './blog-owner-card';
import './blog-sidebar.css';

/** 목록 옆 사이드바: 주인 소개(주인장에게는 글 쓰기와 열람 요청), 방별 글 수, 많이 쓴 태그. 공개 범위는 검색창 옆 칩에서 거름 */
export function BlogSidebar({ query }: { query: BlogListQuery }) {
  const { user, ready, can } = useSession();
  const userId = user?.id ?? null;
  const owner = can('blog:write');
  const canGrant = can('blog:grant');
  const [summary, setSummary] = useState<BlogSummary | null>(null);
  const [pending, setPending] = useState(0);
  const { room = null, tag = null, q = null, visibility = null } = query;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    // 사이드바만 비어 보일 뿐 목록은 따로 받으므로 실패는 넘어감
    getBlogSummary().then((value) => active && setSummary(value), () => {});
    return () => {
      active = false;
    };
  }, [ready, userId]);

  useEffect(() => {
    if (!canGrant) return;
    listAccessRequests().then(({ requests }) => setPending(requests.length), () => {});
  }, [canGrant]);

  // 방이 없는 글은 '기타'. 방을 하나도 안 만들었으면 '전체 글' 과 같아서 두지 않음. 주인장은 관리실에서 방에 넣을 수 있음
  const rooms = summary?.rooms ?? [];
  const groups: { label: string; room: string | null; count: number | null | undefined }[] = [
    { label: '전체 글', room: null, count: summary?.total },
    ...rooms.map((item) => ({ label: item.name, room: item.id, count: item.count })),
    ...(rooms.length && summary?.unsorted ? [{ label: '기타', room: NO_ROOM, count: summary.unsorted }] : []),
  ];

  return (
    <aside className="blog-sidebar" aria-label="블로그 안내">
      {summary?.owner && (
        <BlogOwnerCard owner={summary.owner}>
          {owner && (
            <div className="blog-owner-tools">
              <Link className="tape" href={routes.blogWrite}>
                글 쓰기
              </Link>
              {canGrant && (
                <Link className="blog-owner-requests" href={routes.blogRequests} aria-label={pending ? `열람 요청 ${pending}건` : '열람 요청'}>
                  열람 요청
                  {pending > 0 && <span className="blog-count-badge">{pending > 99 ? '99+' : pending}</span>}
                </Link>
              )}
            </div>
          )}
        </BlogOwnerCard>
      )}

      <section className="blog-side-block" aria-labelledby="blog-side-groups">
        <div className="blog-side-head">
          <h2 id="blog-side-groups">방</h2>
          {owner && (
            <Link className="blog-side-manage" href={routes.blogRooms}>
              방 정리
            </Link>
          )}
        </div>
        <ul className="blog-side-groups">
          {groups.map((group) => (
            <li key={group.room ?? 'all'}>
              <Link
                className={cx(room === group.room && 'is-active')}
                href={routes.blogList({ room: group.room, tag, q, visibility })}
                aria-current={room === group.room ? 'page' : undefined}
                scroll={false}
              >
                <span>{group.label}</span>
                <span className="blog-side-count">{group.count ?? ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {summary && summary.tags.length > 0 && (
        <section className="blog-side-block" aria-labelledby="blog-side-tags">
          <h2 id="blog-side-tags">태그</h2>
          <ul className="blog-side-tags">
            {summary.tags.map((item) => (
              <li key={item.name}>
                <Link
                  className={cx('blog-tag', tag === item.name && 'is-active')}
                  href={routes.blogList({ room, tag: tag === item.name ? null : item.name, q, visibility })}
                  aria-current={tag === item.name ? 'page' : undefined}
                  scroll={false}
                >
                  {item.name}
                  <span className="blog-side-count">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
