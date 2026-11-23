// 화면에 보이는 숫자와 날짜. 서버는 한국 노트북이라 시각은 모두 서울 기준으로 씀

export const formatNumber = (value: number) => value.toLocaleString('ko-KR');

/** 2026.11.21 01:30 */
export function formatStamp(value: string | number | Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(value))
      .map(({ type, value: part }) => [type, part]),
  );
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** 2026년 11월 21일 */
export const formatDate = (value: string) => dateFormat.format(new Date(value));
/** 2026년 11월 21일 오전 1:30 */
export const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value));

const shortDateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

/** 피드처럼 지난 시간으로: 방금 전, 3분 전, 5시간 전, 2일 전, 일주일이 넘으면 11월 21일 (해가 다르면 연도까지) */
export function formatAgo(value: string, now = Date.now()) {
  const date = new Date(value);
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))}일 전`;
  return date.getFullYear() === new Date(now).getFullYear() ? shortDateFormat.format(date) : dateFormat.format(date);
}

/** 가동 시간: 3일 4시간, 5시간 12분, 7분 */
export function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}일 ${hours}시간`;
  if (hours) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

/** 글자 수 표시: 1,234 / 2,000 */
export const formatCount = (length: number, max: number) => `${formatNumber(length)} / ${formatNumber(max)}`;
