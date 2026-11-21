import { communityRequest } from '@shared/api';
import type { InboxPage } from '../model/types';

export const getAdminSummary = () => communityRequest<{ unreadMessages: number; reports: number }>('/admin/summary');

export const listInbox = (before?: string | null) =>
  communityRequest<InboxPage>(`/admin/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`);

/** 지금까지 온 쪽지를 모두 읽은 것으로 바꿈 */
export const markInboxRead = () => communityRequest('/admin/messages/read', { method: 'POST' });
export const deleteMessage = (id: string) => communityRequest(`/admin/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
