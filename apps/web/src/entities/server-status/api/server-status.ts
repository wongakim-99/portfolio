import { communityRequest, getJson } from '@shared/api';
import type { ServerStatus, TopologySnapshot } from '../model/types';

export const getServerStatus = () => getJson<ServerStatus>('/server');

/** since 뒤에 쌓인 요청, DB, 저장소 기록만 받음. 처음에는 since 없이 최근 기록을 받음 */
export const getTopology = (since: number | null) =>
  communityRequest<TopologySnapshot>(`/admin/topology${since === null ? '' : `?since=${since}`}`);
