'use client';

import { useEffect, useState } from 'react';
import { errorStatus } from '@shared/api';
import { getPerformance, type PerformanceRange, type PerformanceView } from '@entities/server-status';

const POLL_MS = 15_000;

export interface PerformanceState {
  data: PerformanceView | null;
  /** 마지막으로 못 받은 까닭. 받았던 것은 그대로 둠 */
  error: string | null;
}

/** 서버 상태를 15초마다 받음. 다른 탭을 보는 동안은 묻지 않고, 돌아오거나 기간을 바꾸면 바로 다시 받음 */
export function usePerformance(range: PerformanceRange): PerformanceState {
  const [state, setState] = useState<PerformanceState>({ data: null, error: null });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      timer = null;
      try {
        const data = await getPerformance(range);
        if (!stopped) setState({ data, error: null });
      } catch (error) {
        if (!stopped) {
          const message = errorStatus(error) === 403 ? '이 계정에는 권한이 없습니다.' : '서버 상태를 받지 못했습니다. 다시 묻는 중';
          setState((value) => ({ ...value, error: message }));
        }
      } finally {
        if (!stopped && !document.hidden) timer = setTimeout(load, POLL_MS);
      }
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else if (!timer) {
        void load();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    void load();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [range]);

  return state;
}
