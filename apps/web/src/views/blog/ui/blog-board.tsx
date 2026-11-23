'use client';

import { useSearchParams } from 'next/navigation';
import { BlogPostGrid } from '@widgets/blog-post-grid';
import { BlogSearch } from '@widgets/blog-search';
import { BlogSidebar } from '@widgets/blog-sidebar';
import type { BlogListQuery, Visibility } from '@entities/blog-post';

const VISIBILITIES: readonly string[] = ['public', 'approved', 'private'];

// 사이드바, 검색, 카드가 같은 거르기를 나눠 씀. 둘 다 .blog-page 격자에 바로 놓이도록 감싸지 않음
export function BlogBoard() {
  const params = useSearchParams();
  const visibility = params.get('visibility');
  const query: BlogListQuery = {
    room: params.get('room'),
    tag: params.get('tag'),
    q: params.get('q'),
    visibility: visibility && VISIBILITIES.includes(visibility) ? (visibility as Visibility) : null,
  };

  return (
    <>
      <BlogSidebar query={query} />
      <div className="blog-board-main">
        <BlogSearch query={query} />
        <BlogPostGrid query={query} />
      </div>
    </>
  );
}
