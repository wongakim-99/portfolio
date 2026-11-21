import { communityRequest } from '@shared/api';
import type { Profile } from '../model/types';

export const getProfile = (id: string) => communityRequest<Profile>(`/users/${encodeURIComponent(id)}`);

export const updateProfile = (body: Record<string, FormDataEntryValue>) =>
  communityRequest<{ user: Profile }>('/me/profile', { method: 'PATCH', body });

/** 정사각형으로 다시 그린 사진을 본문 그대로 올림. 형식과 크기는 API 가 파일 내용으로 다시 확인함 */
export const uploadAvatar = (photo: Blob) => communityRequest<{ avatarUrl: string }>('/me/avatar', { method: 'PUT', file: photo });
export const deleteAvatar = () => communityRequest('/me/avatar', { method: 'DELETE' });
