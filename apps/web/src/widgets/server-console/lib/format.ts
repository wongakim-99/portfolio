// 서버 상태 숫자 표기. 화면 글 규칙에 맞춰 가운뎃점, 대시 없이 씀

const KB = 1024;
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number) {
  let value = bytes;
  let unit = 0;
  while (value >= KB && unit < UNITS.length - 1) {
    value /= KB;
    unit++;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}

export const formatMs = (ms: number | null) => (ms === null ? '없음' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}초` : `${Math.round(ms)}ms`);

/** 0~1 비율. 10% 아래는 소수 한 자리 */
export const formatRatio = (ratio: number | null) => (ratio === null ? '없음' : `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}%`);

export const formatCount = (value: number) => value.toLocaleString('ko-KR');

/** 분당 요청. 1 아래는 소수 한 자리 */
export const formatRate = (value: number) => (value >= 10 ? formatCount(Math.round(value)) : value.toFixed(1));
