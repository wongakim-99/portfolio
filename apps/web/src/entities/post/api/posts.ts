import { communityRequest } from '@shared/api';
import type { YoutubeVideo } from '@shared/ui';
import type { Post, PostInput, PostPage, PostPhoto } from '../model/types';

/** 최근 글 10개씩. author 를 주면 그 회원의 글만 */
export function listPosts({ before, author }: { before?: string | null; author?: string } = {}) {
  const query = new URLSearchParams();
  if (author) query.set('author', author);
  if (before) query.set('before', before);
  const search = query.size ? `?${query}` : '';
  return communityRequest<PostPage>(`/posts${search}`);
}

export const getPost = (id: string) => communityRequest<Post>(`/posts/${encodeURIComponent(id)}`);

export const createPost = (input: PostInput) => communityRequest<{ post: Post }>('/posts', { method: 'POST', body: input });
export const updatePost = (id: string, input: PostInput) =>
  communityRequest<{ post: Post }>(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
export const deletePost = (id: string) => communityRequest(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 관리자 권한(content:moderate)으로 남의 글과 댓글을 지움 */
export const deletePostAsAdmin = (id: string) => communityRequest(`/admin/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 좋아요 누르기(on), 거두기. 바뀐 숫자를 돌려받음 */
export const likePost = (id: string, on: boolean) =>
  communityRequest<{ likeCount: number; liked: boolean }>(`/posts/${encodeURIComponent(id)}/like`, { method: on ? 'PUT' : 'DELETE' });

/** 글에 붙일 사진. 브라우저에서 줄인 사진 파일을 그대로 보냄 */
export const uploadPostPhoto = (photo: Blob) =>
  communityRequest<{ image: PostPhoto & { width: number; height: number } }>('/images', { method: 'POST', file: photo });

/** 글을 쓰는 동안 보여 줄 유튜브 미리보기 (로그인한 회원만) */
export const previewVideo = (id: string) => communityRequest<{ video: YoutubeVideo }>(`/videos/${encodeURIComponent(id)}`);
