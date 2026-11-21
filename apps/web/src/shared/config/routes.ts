// 페이지 주소. 링크와 이동은 모두 여기서 만들어서 주소를 바꿀 때 한곳만 고치면 되게 함
export const routes = {
  home: '/',
  portfolio: '/portfolio',
  feed: '/feed',
  write: '/feed/write',
  admin: '/feed/admin',
  post: (id: string) => `/feed/posts/${encodeURIComponent(id)}`,
  editPost: (id: string) => `/feed/posts/${encodeURIComponent(id)}/edit`,
  user: (id: string) => `/feed/users/${encodeURIComponent(id)}`,
  blog: '/blog',
  /** 그 태그가 붙은 블로그 글만 */
  blogTag: (tag: string) => `/blog?${new URLSearchParams({ tag })}`,
  /** 태그, 검색어, 공개 범위로 거른 블로그 목록. 빈 값은 주소에서 뺌 */
  blogList: ({ tag, q, visibility }: { tag?: string | null; q?: string | null; visibility?: string | null }) => {
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    if (q) params.set('q', q);
    if (visibility) params.set('visibility', visibility);
    return params.size ? `/blog?${params}` : '/blog';
  },
  blogWrite: '/blog/write',
  blogPost: (id: string) => `/blog/posts/${encodeURIComponent(id)}`,
  editBlogPost: (id: string) => `/blog/posts/${encodeURIComponent(id)}/edit`,
  /** 관리실의 블로그 열람 요청 칸 */
  blogRequests: '/feed/admin#blog-requests',
} as const;
