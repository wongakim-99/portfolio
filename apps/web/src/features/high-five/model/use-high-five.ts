'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import { getJson, postJson } from '@shared/api';
import { prefersReducedMotion } from '@shared/lib';

// 하이파이브 상태. 홈의 버튼과 숨은 터미널(hi5, 어느 페이지에서든)이 같은 숫자를 씀
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
}

const INITIAL: HighFive = { total: null, status: '', pressed: false, claps: [] };
let state = INITIAL;
let pending = 0;
let clapId = 0;
let loading = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let pressTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function update(patch: Partial<HighFive>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

/** 누적 수를 한 번 받아 옴. 이미 받았으면 넘어감 */
export function loadHighFives() {
  if (loading || state.total !== null) return;
  loading = true;
  getJson<{ total: number }>('/high-fives')
    .then(({ total }) => update({ total }), () => {})
    .finally(() => {
      loading = false;
    });
}

async function flush() {
  const count = pending;
  pending = 0;
  if (!count) return;
  try {
    const response = await postJson('/high-fives', { count });
    if (response.status === 429) {
      update({ total: (state.total ?? count) - count, status: '너무 빨라요. 조금 쉬었다가 다시 눌러 주세요.' });
      return;
    }
    if (!response.ok) throw new Error(String(response.status));
    const { total, accepted } = (await response.json()) as { total: number; accepted: number };
    update({ total, status: accepted < count ? '오늘은 충분히 받았어요. 내일 또 눌러 주세요.' : '' });
  } catch {
    update({ status: '지금은 전달이 안 돼요. 잠시 뒤에 다시 눌러 주세요.' });
  }
}

/** 버튼이나 숨은 터미널(hi5)이 부름 */
export function giveHighFive() {
  if (pending >= MAX_PENDING) return;
  pending += 1;
  const claps = prefersReducedMotion()
    ? state.claps
    : [
        ...state.claps,
        {
          id: ++clapId,
          text: CLAPS[Math.floor(Math.random() * CLAPS.length)] ?? '짝!',
          style: { '--dx': `${Math.round(Math.random() * 60 - 30)}px`, '--rot': `${Math.round(Math.random() * 30 - 15)}deg` } as CSSProperties,
        },
      ];
  update({ total: (state.total ?? 0) + 1, pressed: true, claps });
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => update({ pressed: false }), PRESS_MS);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_MS);
}

export const dismissClap = (id: number) => update({ claps: state.claps.filter((clap) => clap.id !== id) });

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useHighFive = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
