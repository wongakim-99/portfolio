'use client';

import { useSyncExternalStore } from 'react';
import { readStore, writeStore } from '@shared/lib';

// 로키를 띄울지. 내 페이지의 '화면 설정' 에서 켜고 끄고, 이 브라우저에 남김 (스탠드 'lamp' 와 같은 방식)
// '잠깐 쉬기' 는 그 탭에서만 숨기고(sessionStorage), 쉰 뒤에 설정을 다시 켜면 그 탭에서도 다시 나옴
const KEY = 'rocky';
const REST_KEY = 'gawon:rocky-resting';

interface Preference {
  on: boolean;
  /** 마지막으로 켜거나 끈 때. '잠깐 쉬기' 보다 나중이면 쉬기를 무시함 */
  at: number;
}

export type RockyMode = 'on' | 'off' | 'resting';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function restedAt() {
  try {
    // 예전에는 '1' 을 적었음. 숫자로 읽으면 1 이라 설정을 한 번 켜면 풀림
    return Number(sessionStorage.getItem(REST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function rockyMode(): RockyMode {
  const preference = readStore<Preference>(KEY);
  if (preference && !preference.on) return 'off';
  const rested = restedAt();
  return rested && rested > (preference?.at ?? 0) ? 'resting' : 'on';
}

export function setRockyOn(on: boolean) {
  writeStore(KEY, { on, at: Date.now() } satisfies Preference);
  notify();
}

/** 이 탭에서만 잠깐 숨김 */
export function restRocky() {
  try {
    sessionStorage.setItem(REST_KEY, String(Date.now()));
  } catch {
    // 저장하지 못해도 이번 화면에서는 숨김
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭(내 페이지)에서 켜고 끈 것도 바로 반영함
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) listener();
  };
  window.addEventListener('storage', storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', storage);
  };
}

/** 서버에서 그릴 때는 숨긴 채로 두고, 브라우저에서 실제 값으로 맞춤 */
export const useRockyMode = () => useSyncExternalStore(subscribe, rockyMode, (): RockyMode => 'off');
