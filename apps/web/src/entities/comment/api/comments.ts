import { communityRequest } from '@shared/api';
import type { YoutubeVideo } from '@shared/ui';
import type { Comment, CommentPage } from '../model/types';

/** 오래된 순서로 40개씩. after 뒤의 답글을 이어 받음 */
export const listComments = (postId: string, after?: string | null) =>
  communityRequest<CommentPage>(`/posts/${encodeURIComponent(postId)}/comments${after ? `?after=${encodeURIComponent(after)}` : ''}`);

/** parentId 를 주면 그 답글에 다는 답글 */
export const createComment = (postId: string, body: string, parentId?: string) =>
  communityRequest<{ comment: Comment }>(`/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: { body, ...(parentId ? { parentId } : {}) } });
export const updateComment = (id: string, body: string) =>
  communityRequest<{ comment: { id: string; body: string; video: YoutubeVideo | null } }>(`/comments/${encodeURIComponent(id)}`, { method: 'PATCH', body: { body } });
export const deleteComment = (id: string) => communityRequest(`/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 관리자 권한(content:moderate)으로 남의 답글을 지움 */
export const deleteCommentAsAdmin = (id: string) => communityRequest(`/admin/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 좋아요 누르기(on), 거두기. 바뀐 숫자를 돌려받음 */
export const likeComment = (id: string, on: boolean) =>
  communityRequest<{ likeCount: number; liked: boolean }>(`/comments/${encodeURIComponent(id)}/like`, { method: on ? 'PUT' : 'DELETE' });
