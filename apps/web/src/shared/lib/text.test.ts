import { describe, expect, it } from 'vitest';
import { keepPhrases } from './text';

const glued = (text: string) => keepPhrases(text).replaceAll(' ', '_');

describe('한국어 줄바꿈 다듬기', () => {
  it('의존 명사, 한 글자 관형사, 수식이 따로 끊기지 않게 붙임', () => {
    expect(glued('이 글은 주인장이 허락한 사람만 읽을 수 있습니다.')).toBe('이_글은 주인장이 허락한 사람만 읽을_수_있습니다.');
    expect(glued('그럼 P = NP 만 증명해 주세요.')).toBe('그럼 P_=_NP 만 증명해_주세요.');
    expect(glued('그럼 1 + 1 = 2 를 공리부터')).toBe('그럼 1_+_1_=_2 를 공리부터');
    expect(glued('변수 이름을 한 번에')).toBe('변수 이름을 한_번에');
    expect(glued('직접 부탁할 수도 있습니다.')).toBe('직접 부탁할_수도_있습니다.');
    expect(glued('주인장이 읽어 보고 정합니다. 증명해 주세요.')).toBe('주인장이 읽어_보고 정합니다. 증명해_주세요.');
  });

  it('조사가 붙은 낱말이나 낱말 속 글자는 건드리지 않음', () => {
    expect(glued('주인장이 이번에는 거절했습니다')).toBe('주인장이 이번에는 거절했습니다');
    expect(glued('수학 대신 그러나')).toBe('수학 대신 그러나');
  });
});
