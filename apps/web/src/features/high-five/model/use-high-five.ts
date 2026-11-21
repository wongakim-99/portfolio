'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { getJson, postJson } from '@shared/api';
import { prefersReducedMotion } from '@shared/lib';

// 연타를 0.6초 모아서 한 번에 보냄. 한 번에 10번까지, 한 사람 하루 50번까지는 API 가 셈
const FLUSH_MS = 600;
const MAX_PENDING = 10;
const PRESS_MS = 90;
const CLAPS = ['짝!', '짝짝!', '짝!', '나이스', '짝!'];

export interface Clap {
  id: number;
  text: string;
  style: CSSProperties;
}

export interface HighFive {
  /** 화면에 보이는 누적 수. 아직 모르면 null */
  total: number | null;
  status: string;
  /** 버튼이 눌려 들어간 잠깐 동안 true */
  pressed: boolean;
  /** 버튼 위로 튀어 오르는 '짝!' 글자. 움직임을 줄이는 설정이면 비어 있음 */
  claps: Clap[];
  /** 버튼이나 숨은 터미널(hi5)이 부름 */
  give: () => void;
  dismissClap: (id: number) => void;
}

export function useHighFive(): HighFive {
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [pressed, setPressed] = useState(false);
  const [claps, setClaps] = useState<Clap[]>([]);
  const shown = useRef<number | null>(null);
  const pending = useRef(0);
  const clapId = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((value: number) => {
    shown.current = value;
    setTotal(value);
  }, []);

  useEffect(() => {
    getJson<{ total: number }>('/high-fives').then(({ total: value }) => show(value), () => {});
    return () => {
      clearTimeout(flushTimer.current);
      clearTimeout(pressTimer.current);
    };
  }, [show]);

  const flush = useCallback(async () => {
    const count = pending.current;
    pending.current = 0;
    if (!count) return;
    try {
      const response = await postJson('/high-fives', { count });
      if (response.status === 429) {
        show((shown.current ?? count) - count);
        setStatus('너무 빨라요. 조금 쉬었다가 다시 눌러 주세요.');
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const { total: value, accepted } = (await response.json()) as { total: number; accepted: number };
      show(value);
      setStatus(accepted < count ? '오늘은 충분히 받았어요. 내일 또 눌러 주세요.' : '');
    } catch {
      setStatus('지금은 전달이 안 돼요. 잠시 뒤에 다시 눌러 주세요.');
    }
  }, [show]);

  const give = useCallback(() => {
    if (pending.current >= MAX_PENDING) return;
    pending.current += 1;
    show((shown.current ?? 0) + 1);

    setPressed(true);
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setPressed(false), PRESS_MS);
    if (!prefersReducedMotion()) {
      const clap: Clap = {
        id: ++clapId.current,
        text: CLAPS[Math.floor(Math.random() * CLAPS.length)] ?? '짝!',
        style: { '--dx': `${Math.round(Math.random() * 60 - 30)}px`, '--rot': `${Math.round(Math.random() * 30 - 15)}deg` } as CSSProperties,
      };
      setClaps((list) => [...list, clap]);
    }

    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, FLUSH_MS);
  }, [flush, show]);

  const dismissClap = useCallback((id: number) => setClaps((list) => list.filter((clap) => clap.id !== id)), []);

  return { total, status, pressed, claps, give, dismissClap };
}
