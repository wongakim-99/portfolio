import { communityRequest } from '@shared/api';
import type { Comment, CommentPage } from '../model/types';

/** 오래된 순서로 40개씩. after 뒤의 댓글을 이어 받음 */
export const listComments = (postId: string, after?: string | null) =>
  communityRequest<CommentPage>(`/posts/${encodeURIComponent(postId)}/comments${after ? `?after=${encodeURIComponent(after)}` : ''}`);

export const createComment = (postId: string, body: string) =>
  communityRequest<{ comment: Comment }>(`/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: { body } });
export const updateComment = (id: string, body: string) =>
  communityRequest(`/comments/${encodeURIComponent(id)}`, { method: 'PATCH', body: { body } });
export const deleteComment = (id: string) => communityRequest(`/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 관리자 권한(content:moderate)으로 남의 댓글을 지움 */
export const deleteCommentAsAdmin = (id: string) => communityRequest(`/admin/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
