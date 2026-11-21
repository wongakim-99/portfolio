'use client';

import { useSyncExternalStore } from 'react';

// 숨은 터미널이 열려 있는지. 상단 버튼(어느 페이지든)과 터미널 창(app/layout.tsx 에 하나)이 같이 봄
let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export const openTerminal = () => set(true);
export const closeTerminal = () => set(false);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useTerminalOpen = () =>
  useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
