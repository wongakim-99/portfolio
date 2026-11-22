import { describe, expect, it } from 'vitest';
import type { Member } from '@entities/user';
import { dailySignups, filterMembers, formatAgo, rosterCounts, seoulDate } from './roster';

const NOW = Date.parse('2026-11-22T03:00:00Z'); // 서울 11월 22일 정오
const member = (id: string, createdAt: string, extra: Partial<Member> = {}): Member => ({
  id, name: `회원${id}`, email: `m${id}@example.com`, bio: '', avatarUrl: null, role: 'member', createdAt,
  verifiedAt: createdAt, lastLoginAt: null, activeSessions: 0, ...extra,
});

describe('관리실 회원 숫자', () => {
  it('가입 날짜는 서울 기준으로 나눔', () => {
    expect(seoulDate('2026-11-21T15:30:00Z')).toBe('2026-11-22');
    expect(seoulDate('2026-11-21T14:59:00Z')).toBe('2026-11-21');
  });

  it('최근 며칠의 날짜별 가입 수를 오늘까지 빈 날 없이 셈', () => {
    const members = [member('1', '2026-11-21T15:30:00Z'), member('2', '2026-11-22T01:00:00Z'), member('3', '2026-11-20T02:00:00Z')];
    expect(dailySignups(members, 3, NOW)).toEqual([
      { date: '2026-11-20', count: 1 },
      { date: '2026-11-21', count: 0 },
      { date: '2026-11-22', count: 2 },
    ]);
  });

  it('확인 대기, 관리자, 최근 7일 가입을 세고 이름이나 이메일로 거름', () => {
    const members = [
      member('1', '2026-11-21T00:00:00Z', { role: 'owner' }),
      member('2', '2026-11-01T00:00:00Z', { role: 'admin', name: '운영 친구' }),
      member('3', '2026-11-22T00:00:00Z', { verifiedAt: null }),
    ];
    expect(rosterCounts(members, NOW)).toEqual({ verified: 2, pending: 1, staff: 2, lastWeek: 2 });
    expect(filterMembers(members, '', 'staff').map((m) => m.id)).toEqual(['1', '2']);
    expect(filterMembers(members, '', 'pending').map((m) => m.id)).toEqual(['3']);
    expect(filterMembers(members, '운영', 'all').map((m) => m.id)).toEqual(['2']);
    expect(filterMembers(members, 'M3@EXAMPLE', 'all').map((m) => m.id)).toEqual(['3']);
  });

  it('마지막 로그인은 지난 시간으로, 오래되면 날짜로 씀', () => {
    expect(formatAgo('2026-11-22T02:59:40Z', NOW)).toBe('방금');
    expect(formatAgo('2026-11-22T02:48:00Z', NOW)).toBe('12분 전');
    expect(formatAgo('2026-11-21T22:00:00Z', NOW)).toBe('5시간 전');
    expect(formatAgo('2026-11-17T03:00:00Z', NOW)).toBe('5일 전');
    expect(formatAgo('2026-09-01T03:00:00Z', NOW)).toBe('2026.09.01');
  });
});
