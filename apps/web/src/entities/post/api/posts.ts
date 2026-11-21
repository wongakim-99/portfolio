import { communityRequest } from '@shared/api';
import type { Post, PostPage } from '../model/types';

/** 최근 글 10개씩. author 를 주면 그 회원의 글만 */
export function listPosts({ before, author }: { before?: string | null; author?: string } = {}) {
  const query = new URLSearchParams();
  if (author) query.set('author', author);
  if (before) query.set('before', before);
  const search = query.size ? `?${query}` : '';
  return communityRequest<PostPage>(`/posts${search}`);
}

export const getPost = (id: string) => communityRequest<Post>(`/posts/${encodeURIComponent(id)}`);

type PostInput = { title: string; body: string };
export const createPost = (input: PostInput) => communityRequest<{ post: Post }>('/posts', { method: 'POST', body: input });
export const updatePost = (id: string, input: PostInput) =>
  communityRequest<{ post: Post }>(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
export const deletePost = (id: string) => communityRequest(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 관리자 권한(content:moderate)으로 남의 글과 댓글을 지움 */
export const deletePostAsAdmin = (id: string) => communityRequest(`/admin/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
