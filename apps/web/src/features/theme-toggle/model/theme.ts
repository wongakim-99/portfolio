'use client';

import { useSyncExternalStore } from 'react';
import { writeStore } from '@shared/lib';

// 스탠드를 끄면 어두운 화면. 고른 값은 'lamp' 에 남기고, app/layout.tsx 의 첫 스크립트가 그리기 전에 다시 적용함
// 고른 적이 없으면 운영체제 설정(prefers-color-scheme)을 따름
const darkQuery = () => matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

export function isDarkTheme() {
  const theme = document.documentElement.dataset.theme;
  return theme ? theme === 'dark' : darkQuery().matches;
}

/** 스탠드를 켜거나 끄고, 바뀐 뒤 어두운지 돌려줌 */
export function toggleTheme() {
  const dark = !isDarkTheme();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  writeStore('lamp', dark ? 'off' : 'on');
  for (const listener of listeners) listener();
  return dark;
}

function subscribe(listener: () => void) {
  const query = darkQuery();
  listeners.add(listener);
  query.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener('change', listener);
  };
}

/** 서버에서 그릴 때는 밝은 화면으로 두고, 브라우저에서 실제 값으로 맞춤 */
export const useDarkTheme = () => useSyncExternalStore(subscribe, isDarkTheme, () => false);
