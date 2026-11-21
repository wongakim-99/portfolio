'use client';

import { useEffect, useState } from 'react';
import { getServerStatus } from '../api/server-status';
import type { ServerSnapshot } from './types';

const REFRESH_MS = 10_000;
const SPARK_POINTS = 30;

export interface ServerStatusState {
  /** 마지막으로 받은 상태. 한 번 실패해도 영수증 숫자는 남겨 둠 */
  latest: ServerSnapshot | null;
  /** 아직 모르면 null, 마지막 요청이 성공했으면 true */
  online: boolean | null;
  /** 1분 부하 기록. 영수증의 작은 선 그래프에 씀 */
  loads: number[];
}

// 집 노트북의 실제 상태를 10초마다 받음. 다른 탭을 보는 동안에는 묻지 않음
export function useServerStatus(): ServerStatusState {
  const [state, setState] = useState<ServerStatusState>({ latest: null, online: null, loads: [] });

  useEffect(() => {
    let active = true;
    async function refresh() {
      const started = performance.now();
      try {
        const status = await getServerStatus();
        const ping = Math.round(performance.now() - started);
        if (!active) return;
        setState((prev) => ({
          latest: { ...status, ping },
          online: true,
          loads: [...prev.loads, status.load].slice(-SPARK_POINTS),
        }));
      } catch {
        if (active) setState((prev) => ({ ...prev, online: false }));
      }
    }
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return state;
}
