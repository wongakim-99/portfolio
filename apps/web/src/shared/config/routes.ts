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
  blogWrite: '/blog/write',
  blogPost: (id: string) => `/blog/posts/${encodeURIComponent(id)}`,
  editBlogPost: (id: string) => `/blog/posts/${encodeURIComponent(id)}/edit`,
  /** 관리실의 블로그 열람 요청 칸 */
  blogRequests: '/feed/admin#blog-requests',
} as const;
