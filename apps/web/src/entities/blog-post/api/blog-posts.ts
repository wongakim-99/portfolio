import { blogRequest } from '@shared/api';
import type { AccessRequestState, BlogListQuery, BlogPost, BlogPostInput, BlogPostPage, BlogSummary } from '../model/types';

/** 최근 글 10개씩. 잠긴 글은 제목과 태그만, 나만 보기 글은 주인장에게만 옴 */
export function listBlogPosts({ before, tag, q, visibility }: BlogListQuery & { before?: string | null } = {}) {
  const query = new URLSearchParams();
  if (tag) query.set('tag', tag);
  if (q) query.set('q', q);
  if (visibility) query.set('visibility', visibility);
  if (before) query.set('before', before);
  return blogRequest<BlogPostPage>(`/posts${query.size ? `?${query}` : ''}`);
}

/** 공개 범위별 글 수, 많이 쓴 태그, 주인장 소개 */
export const getBlogSummary = () => blogRequest<BlogSummary>('/summary');

export const getBlogPost = (id: string) => blogRequest<BlogPost>(`/posts/${encodeURIComponent(id)}`);

export const createBlogPost = (input: BlogPostInput) => blogRequest<{ post: BlogPost }>('/posts', { method: 'POST', body: input });
export const updateBlogPost = (id: string, input: BlogPostInput) =>
  blogRequest<{ post: BlogPost }>(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
export const deleteBlogPost = (id: string) => blogRequest(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 잠긴 글의 '주인장에게 요청하기'. 로그인한 회원만 */
export const requestBlogAccess = (id: string, message: string) =>
  blogRequest<{ request: AccessRequestState }>(`/posts/${encodeURIComponent(id)}/access-requests`, { method: 'POST', body: { message } });
