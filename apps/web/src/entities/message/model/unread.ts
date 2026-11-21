'use client';

import { useSyncExternalStore } from 'react';

// 상단 관리실 배지의 새 쪽지 수. 관리실 쪽지함이 읽음 처리하면 배지도 바로 0 이 되도록 한곳에 둠
let unread = 0;
const listeners = new Set<() => void>();

export function setUnreadMessages(count: number) {
  unread = count;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useUnreadMessages = () =>
  useSyncExternalStore(
    subscribe,
    () => unread,
    () => 0,
  );
