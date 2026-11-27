import { communityRequest, getJson } from '@shared/api';
import type { PerformanceRange, PerformanceView, ServerStatus, TopologySnapshot } from '../model/types';

export const getServerStatus = () => getJson<ServerStatus>('/server');

/** since 뒤에 쌓인 요청, DB, 저장소 기록만 받음. 처음에는 since 없이 최근 기록을 받음 */
export const getTopology = (since: number | null) =>
  communityRequest<TopologySnapshot>(`/admin/topology${since === null ? '' : `?since=${since}`}`);

/** 관리실 서버 상태. 맨 위 점검표와 range 기간 그래프 */
export const getPerformance = (range: PerformanceRange) => communityRequest<PerformanceView>(`/admin/performance?range=${range}`);
