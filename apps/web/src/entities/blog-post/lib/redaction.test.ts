import { describe, expect, it } from 'vitest';
import { redactedLines } from './redaction';

describe('redactedLines', () => {
  it('같은 글이면 늘 같은 줄 모양이고, 글마다 다름', () => {
    expect(redactedLines('6b02cc1289b6a0849c81b8a5')).toEqual(redactedLines('6b02cc1289b6a0849c81b8a5'));
    expect(redactedLines('6b02cc1289b6a0849c81b8a5')).not.toEqual(redactedLines('6b02c8bc0014da43cad1f989'));
  });

  it('세 줄에 줄마다 막대 2~4개, 마지막 줄은 짧고 어느 줄도 카드 폭을 넘지 않음', () => {
    for (const seed of ['a', 'b', 'c', '6b02cc1289b6a0849c81b8a5']) {
      const lines = redactedLines(seed);
      expect(lines).toHaveLength(3);
      const widths = lines.map((bars) => bars.reduce((a, b) => a + b, 0));
      lines.forEach((bars) => expect(bars.length).toBeGreaterThanOrEqual(2));
      lines.forEach((bars) => expect(bars.length).toBeLessThanOrEqual(4));
      widths.forEach((width) => expect(width).toBeLessThanOrEqual(101));
      expect(widths[2]).toBeLessThan(widths[0]!);
    }
  });
});
