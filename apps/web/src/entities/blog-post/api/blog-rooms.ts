import { blogRequest } from '@shared/api';
import type { BlogRoomRef, RoomOverview, RoomSuggestion } from '../model/types';

// 관리실의 블로그 방 (blog:write). apps/api 의 blog-admin.controller.ts
const room = (id: string) => `/admin/rooms/${encodeURIComponent(id)}`;

export const getRoomOverview = () => blogRequest<RoomOverview>('/admin/rooms');
export const createRoom = (name: string) => blogRequest<{ room: BlogRoomRef }>('/admin/rooms', { method: 'POST', body: { name } });
export const renameRoom = (id: string, name: string) => blogRequest(room(id), { method: 'PATCH', body: { name } });
export const reorderRooms = (ids: string[]) => blogRequest('/admin/rooms/order', { method: 'PUT', body: { ids } });
export const deleteRoom = (id: string) => blogRequest(room(id), { method: 'DELETE' });

/** 방 없는 글마다 AI 가 고른 방. 저장하지 않음 */
export const suggestRooms = () => blogRequest<{ suggestions: RoomSuggestion[] }>('/admin/rooms/suggest', { method: 'POST' });
/** 쓰고 있는 글에 알맞은 방 */
export const suggestDraftRoom = (draft: { title: string; body: string; tags: string[] }) =>
  blogRequest<{ roomId: string | null }>('/admin/rooms/suggest-draft', { method: 'POST', body: draft });
/** 주인장이 확인한 방을 넣음 */
export const assignRooms = (assignments: { postId: string; roomId: string }[]) =>
  blogRequest<{ assigned: number }>('/admin/rooms/assign', { method: 'POST', body: { assignments } });
