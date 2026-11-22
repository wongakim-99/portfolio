import { useSyncExternalStore } from 'react';

// 관리실의 지금 칸은 주소의 # 뒤에 둠. 블로그 머리와 알림 메일의 /feed/admin#blog-requests 링크가 그 칸을 바로 엶

const subscribe = (listener: () => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};

export const useHash = () => useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => '');

/** 칸을 바꿀 때 방문 기록을 쌓지 않고 # 만 바꿈. replaceState 는 hashchange 를 안 내서 직접 알림 */
export function replaceHash(value: string) {
  window.history.replaceState(window.history.state, '', `#${value}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
