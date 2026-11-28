import { communityRequest } from '@shared/api';
import type { GuardOverview } from '../model/types';

export const getGuardOverview = () => communityRequest<GuardOverview>('/admin/guard');
export const liftGuardBan = (id: string) => communityRequest(`/admin/guard/bans/${encodeURIComponent(id)}`, { method: 'DELETE' });
