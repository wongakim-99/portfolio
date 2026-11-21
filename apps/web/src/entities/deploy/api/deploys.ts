import { getJson } from '@shared/api';
import type { DeployRecord } from '../model/types';

/** 최근 배포부터 limit 건 (최대 30) */
export const getDeploys = async (limit = 10) => (await getJson<{ deploys: DeployRecord[] }>(`/deploys?limit=${limit}`)).deploys;
