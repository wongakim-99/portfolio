import { communityRequest } from '@shared/api';
import type { Member } from '../model/types';

/** 관리실 회원 목록. 확인 대기 가입까지 최근 가입 순. limited 면 1000명에서 잘림 */
export const listMembers = () => communityRequest<{ members: Member[]; limited: boolean }>('/admin/members');

/** 주인장만. 주인장 자신과 다른 주인장은 바꿀 수 없음 */
export const setMemberRole = (id: string, role: 'member' | 'admin') =>
  communityRequest<{ member: Member }>(`/admin/members/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: { role } });
