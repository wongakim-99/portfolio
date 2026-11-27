import { describe, expect, it } from 'vitest';
import { dayLabel, formatWritingTime, inkLevel, monthWeeks, seoulToday, shiftMonth } from './calendar';

describe('책상 달력 날짜 계산', () => {
  it('서울 날짜로 오늘을 셈 (UTC 로는 전날 밤)', () => {
    expect(seoulToday(Date.parse('2026-11-27T16:30:00Z'))).toBe('2026-11-28');
  });

  it('달을 앞뒤로 넘기면 해도 넘어감', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });

  it('달력 칸은 일요일부터 주마다 일곱 칸이고, 그달 날짜만 채움', () => {
    const weeks = monthWeeks('2026-11');
    // 2026년 11월 1일은 일요일, 30일까지 다섯 주
    expect(weeks).toHaveLength(5);
    expect(weeks[0]![0]).toBe('2026-11-01');
    expect(weeks[4]!.filter(Boolean)).toEqual(['2026-11-29', '2026-11-30']);
    expect(monthWeeks('2028-02').flat().filter(Boolean)).toHaveLength(29);
    expect(monthWeeks('2026-08')[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
  });

  it('쓴 시간과 커피 자국 진하기, 날짜 이름', () => {
    expect([0, 12, 45, 72, 200].map(inkLevel)).toEqual([0, 1, 2, 3, 4]);
    expect([45, 72, 120].map(formatWritingTime)).toEqual(['45분', '1시간 12분', '2시간']);
    expect(dayLabel('2026-11-27')).toBe('11월 27일 금요일');
  });
});
