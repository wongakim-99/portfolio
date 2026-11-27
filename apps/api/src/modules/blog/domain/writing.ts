// 책상 달력: 글쓰기 화면에서 글이 바뀐 '분'을 모아 서울 날짜별로 쓴 시간을 셈
// 분은 1970년부터 센 UTC 분(Date.now() / 60000). 1분 안에 한 번이라도 고쳤으면 그 1분을 쓴 것으로 봄

const KST_OFFSET_MS = 9 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** 한 번에 받는 분 수. 임시저장은 길어야 30초마다 보내서 넉넉함 */
export const MINUTES_MAX = 500;
/** 받을 수 있는 분은 지난 36시간부터 5분 뒤까지. 지난 날의 쓴 시간을 꾸며 넣지 못하게 */
const PAST_MINUTES = 36 * 60;
const FUTURE_MINUTES = 5;

export const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** 분을 서울 날짜(2026-11-27)로 */
export const seoulDayOf = (time: number) => new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
const seoulDayOfMinute = (minute: number) => seoulDayOf(minute * 60_000);

/** 서울 날짜의 0시 (UTC 시각) */
export const seoulDayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - KST_OFFSET_MS);

/** 받은 분 가운데 정수이고 받을 수 있는 때인 것만 겹치지 않게 골라 서울 날짜별로 묶음 */
export function minutesByDay(minutes: number[], now: number): Map<string, number[]> {
  const current = Math.floor(now / 60_000);
  const valid = [...new Set(minutes)].filter((minute) => Number.isInteger(minute) && minute >= current - PAST_MINUTES && minute <= current + FUTURE_MINUTES);
  const days = new Map<string, number[]>();
  for (const minute of valid) {
    const day = seoulDayOfMinute(minute);
    days.set(day, [...(days.get(day) ?? []), minute]);
  }
  return days;
}

/** 그달의 첫날과 마지막 날(서울), 그달이 시작하고 끝나는 때(UTC) */
export function monthRange(month: string) {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const first = `${month}-01`;
  const next = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
  // 다음 달 첫날 0시에서 하루를 빼면 이달 마지막 날 0시
  const last = seoulDayOf(seoulDayStart(next).getTime() - DAY_MS);
  return { first, last, from: seoulDayStart(first), to: seoulDayStart(next) };
}
