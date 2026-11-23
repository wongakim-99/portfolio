'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { cx } from '@shared/lib';
import type { BlogListQuery, Visibility } from '@entities/blog-post';
import { useSession } from '@entities/user';
import './blog-search.css';

const SEARCH_DELAY_MS = 300;

/** 목록 위 검색창과 공개 범위 칩. 거르기는 주소(?q=, ?visibility=)에 남아서 뒤로 가기와 공유가 됨. 고른 방(?room=)은 그대로 둠 */
export function BlogSearch({ query }: { query: BlogListQuery }) {
  const router = useRouter();
  const { can } = useSession();
  const owner = can('blog:write');
  const { room = null, tag = null, q = null, visibility = null } = query;
  const [text, setText] = useState(q ?? '');
  const [lastQ, setLastQ] = useState(q ?? '');

  // 뒤로 가기처럼 주소가 바뀌면 입력칸도 따라감
  if ((q ?? '') !== lastQ) {
    setLastQ(q ?? '');
    setText(q ?? '');
  }

  // 입력을 멈추고 잠깐 뒤에 주소를 바꿔 목록을 다시 받음
  useEffect(() => {
    const next = text.trim();
    if (next === (q ?? '')) return;
    const timer = window.setTimeout(() => router.replace(routes.blogList({ room, tag, visibility, q: next }), { scroll: false }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text, room, tag, q, visibility, router]);

  const chips: { label: string; visibility: Visibility | null }[] = [
    { label: '전체', visibility: null },
    { label: '누구나 읽는 글', visibility: 'public' },
    { label: owner ? '허락한 사람만' : '잠긴 글', visibility: 'approved' },
    ...(owner ? [{ label: '나만 보기', visibility: 'private' as const }] : []),
  ];

  return (
    <div className="blog-search">
      <form
        className="blog-search-box"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          router.replace(routes.blogList({ room, tag, visibility, q: text.trim() }), { scroll: false });
        }}
      >
        <label className="sr" htmlFor="blog-search-input">
          글 검색
        </label>
        <input
          id="blog-search-input"
          type="search"
          value={text}
          maxLength={40}
          placeholder="제목이나 태그로 찾기"
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
        />
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </form>
      <nav className="blog-chips" aria-label="분류">
        {chips.map((chip) => (
          <Link
            key={chip.label}
            className={cx('blog-chip', visibility === chip.visibility && 'is-active')}
            href={routes.blogList({ room, tag, q, visibility: chip.visibility })}
            aria-current={visibility === chip.visibility ? 'page' : undefined}
            scroll={false}
          >
            {chip.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
