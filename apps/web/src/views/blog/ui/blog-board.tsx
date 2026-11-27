'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { routes } from '@shared/config';
import { BlogPostGrid } from '@widgets/blog-post-grid';
import { BlogSearch } from '@widgets/blog-search';
import { BlogSidebar } from '@widgets/blog-sidebar';
import { ThreadBoard } from '@widgets/thread-board';
import type { BlogListQuery, Visibility } from '@entities/blog-post';

const VISIBILITIES: readonly string[] = ['public', 'approved', 'private'];

// 사이드바, 검색, 카드가 같은 거르기를 나눠 씀. 둘 다 .blog-page 격자에 바로 놓이도록 감싸지 않음
// ?view=board 면 카드를 책상에 펼치는 대신 코르크판에 꽂고 실로 이어 봄. 거르기를 바꿔도 보던 모양을 이어 감
export function BlogBoard() {
  const params = useSearchParams();
  const visibility = params.get('visibility');
  const query: BlogListQuery = {
    room: params.get('room'),
    tag: params.get('tag'),
    q: params.get('q'),
    visibility: visibility && VISIBILITIES.includes(visibility) ? (visibility as Visibility) : null,
    view: params.get('view') === 'board' ? 'board' : null,
  };

  return (
    <>
      <BlogSidebar query={query} />
      <div className="blog-board-main">
        <BlogSearch query={query} />
        <nav className="blog-view-switch" aria-label="목록 모양">
          <Link href={routes.blogList({ ...query, view: null })} aria-current={query.view ? undefined : 'page'} scroll={false}>
            책상에 펼치기
          </Link>
          <Link href={routes.blogList({ ...query, view: 'board' })} aria-current={query.view ? 'page' : undefined} scroll={false}>
            코르크판에 꽂기
          </Link>
        </nav>
        {query.view === 'board' ? <ThreadBoard query={query} /> : <BlogPostGrid query={query} />}
      </div>
    </>
  );
}
