'use client';

import { useSyncExternalStore } from 'react';
import { writeStore } from '@shared/lib';

// 코르크판에서 끌어 옮긴 카드 자리. 이 브라우저에만 남김 (테마, 로키 설정과 같은 방식)
// 서버와 처음 그릴 때는 늘 빈 자리라서 서버 HTML 과 어긋나지 않고, 화면을 붙인 뒤에 저장된 자리로 바뀜

const KEY = 'blog-board-moved';

/** 카드 ID 마다 옮긴 자리. x 는 판 너비에 대한 비율이라 화면 폭이 바뀌어도 비슷한 자리 */
export type MovedCards = Record<string, { fx: number; y: number }>;

const EMPTY: MovedCards = {};
const listeners = new Set<() => void>();
// 저장소 글자가 그대로면 같은 객체를 돌려줘야 해서(useSyncExternalStore) 마지막으로 읽은 글자와 값을 둠
let last: { raw: string | null; value: MovedCards } = { raw: null, value: EMPTY };

function read(): MovedCards {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // 사생활 보호 모드처럼 저장소가 막혀 있으면 옮긴 자리 없음
  }
  if (raw === last.raw) return last.value;
  let value = EMPTY;
  try {
    value = raw ? (JSON.parse(raw) as MovedCards) : EMPTY;
  } catch {
    value = EMPTY;
  }
  last = { raw, value };
  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 옮겨도 따라 바뀜
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export const useMovedCards = () => useSyncExternalStore(subscribe, read, () => EMPTY);

/** 옮긴 자리를 남김. 빈 값이면 지움(처음 자리로) */
export function saveMovedCards(moved: MovedCards) {
  writeStore(KEY, Object.keys(moved).length ? moved : null);
  listeners.forEach((listener) => listener());
}
