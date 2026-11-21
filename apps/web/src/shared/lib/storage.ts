// 브라우저 저장소는 사생활 보호 모드 등에서 막혀 있을 수 있으니 실패해도 넘어감

export function readStore<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

/** null 을 넣으면 지움 */
export function writeStore(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장만 못 할 뿐 화면은 그대로 동작함
  }
}
