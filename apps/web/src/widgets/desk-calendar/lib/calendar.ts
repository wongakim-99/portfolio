import { formatStamp } from '@shared/lib';

// 책상 달력의 날짜 계산. 날짜는 모두 서울 날짜 문자열(2026-11-27)로 다룸

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 서울 날짜로 오늘 */
export const seoulToday = (now = Date.now()) => formatStamp(now).slice(0, 10).replace(/\./g, '-');

/** 2026-11 에서 delta 달 앞뒤 */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + mon - 1 + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** 달력 칸을 주마다 일요일부터. 그달이 아닌 앞뒤 칸은 null */
export function monthWeeks(month: string): (string | null)[][] {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const firstWeekday = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** 커피 자국 진하기. 0 은 자국 없음, 30분, 1시간, 2시간을 넘을 때마다 진해짐 */
export const inkLevel = (minutes: number) => (minutes <= 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4);

/** 45분, 1시간 12분, 2시간 */
export function formatWritingTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}분`;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

/** 11월 27일 금요일 */
export function dayLabel(day: string) {
  const [year, mon, date] = day.split('-').map(Number) as [number, number, number];
  return `${mon}월 ${date}일 ${WEEKDAYS[new Date(Date.UTC(year, mon - 1, date)).getUTCDay()]}요일`;
}
