import { blogRequest } from '@shared/api';
import type { AccessRequestState, BlogPost, BlogPostInput, BlogPostPage } from '../model/types';

/** 최근 글 10개씩. 잠긴 글은 제목만, 나만 보기 글은 주인장에게만 옴 */
export const listBlogPosts = (before?: string | null) =>
  blogRequest<BlogPostPage>(`/posts${before ? `?${new URLSearchParams({ before })}` : ''}`);

export const getBlogPost = (id: string) => blogRequest<BlogPost>(`/posts/${encodeURIComponent(id)}`);

export const createBlogPost = (input: BlogPostInput) => blogRequest<{ post: BlogPost }>('/posts', { method: 'POST', body: input });
export const updateBlogPost = (id: string, input: BlogPostInput) =>
  blogRequest<{ post: BlogPost }>(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
export const deleteBlogPost = (id: string) => blogRequest(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 잠긴 글의 '주인장에게 요청하기'. 로그인한 회원만 */
export const requestBlogAccess = (id: string, message: string) =>
  blogRequest<{ request: AccessRequestState }>(`/posts/${encodeURIComponent(id)}/access-requests`, { method: 'POST', body: { message } });
