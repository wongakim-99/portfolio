'use client';

import { useEffect, useState } from 'react';
import { getDeploys } from '../api/deploys';
import type { DeployRecord } from './types';

/** 최근 배포 기록. 아직 모르면 null, 못 불러오면 빈 목록 */
export function useRecentDeploys(limit: number) {
  const [deploys, setDeploys] = useState<DeployRecord[] | null>(null);
  useEffect(() => {
    let active = true;
    getDeploys(limit).then(
      (list) => active && setDeploys(list),
      () => active && setDeploys([]),
    );
    return () => {
      active = false;
    };
  }, [limit]);
  return deploys;
}
