'use client';

import { useEffect, useState } from 'react';
import { postJson } from '@shared/api';

// 홈에 들어올 때마다 방문을 남김. 같은 방문자는 30분 안에 다시 와도 API 가 한 번만 셈
async function recordVisit() {
  const response = await postJson('/views');
  if (!response.ok) throw new Error(String(response.status));
  return ((await response.json()) as { total: number }).total;
}

/** 누적 방문 수. 아직 모르거나 실패하면 null */
export function useVisitCount() {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    recordVisit().then(
      (value) => active && setTotal(value),
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);
  return total;
}
