// 관리실 회원 칸의 숫자 계산. 날짜는 서버와 같은 서울 기준
import type { Member } from '@entities/user';

const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;

export type MemberFilter = 'all' | 'staff' | 'pending';

/** 서울 날짜 2026-11-22 */
export const seoulDate = (value: string | number | Date) => new Date(new Date(value).getTime() + KST_MS).toISOString().slice(0, 10);

/** 최근 days 일(오늘 포함) 날짜별 가입 수. 확인 대기 가입도 셈 */
export function dailySignups(members: readonly Member[], days: number, now = Date.now()): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const member of members) counts.set(seoulDate(member.createdAt), (counts.get(seoulDate(member.createdAt)) ?? 0) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = seoulDate(now - (days - 1 - index) * DAY_MS);
    return { date, count: counts.get(date) ?? 0 };
  });
}

export function rosterCounts(members: readonly Member[], now = Date.now()) {
  return {
    verified: members.filter((member) => member.verifiedAt).length,
    pending: members.filter((member) => !member.verifiedAt).length,
    staff: members.filter((member) => member.role !== 'member').length,
    lastWeek: members.filter((member) => now - new Date(member.createdAt).getTime() < 7 * DAY_MS).length,
  };
}

/** 이름이나 이메일에 검색어가 들어 있고 고른 분류에 맞는 회원 */
export function filterMembers(members: readonly Member[], query: string, filter: MemberFilter): Member[] {
  const needle = query.trim().toLowerCase();
  return members.filter((member) => {
    if (filter === 'staff' && member.role === 'member') return false;
    if (filter === 'pending' && member.verifiedAt) return false;
    return !needle || member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle);
  });
}

/** 방금, 12분 전, 3시간 전, 5일 전. 30일이 넘으면 날짜 */
export function formatAgo(value: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 30 * 24 * 60) return `${Math.floor(minutes / (24 * 60))}일 전`;
  return seoulDate(value).replaceAll('-', '.');
}
