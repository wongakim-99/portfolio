import { describe, expect, it } from 'vitest';
import { EASIER_PROBLEMS, gradeProof, OPEN_PROBLEMS, problemFor, problemSequence } from './problems';

describe('잠긴 글의 증명 문제', () => {
  it('글마다 같은 문제를 냄', () => {
    const id = '6650a1b2c3d4e5f6a7b8c9d0';
    expect(problemFor(id)).toBe(problemFor(id));
    expect(OPEN_PROBLEMS).toContain(problemFor(id));
    expect(new Set(OPEN_PROBLEMS.map((problem) => problem.id)).size).toBe(OPEN_PROBLEMS.length);
    expect(EASIER_PROBLEMS.at(-1)?.id).toBe('naming');
  });

  it('어느 글이든 P = NP 와 리만 가설이 한 번씩 나오고 첫 문제와 겹치지 않음', () => {
    // 'a' 를 1~7번 늘어놓으면 글자 합이 7로 나눈 나머지를 모두 돌아서 첫 문제 7개가 다 나옴
    const ids = Array.from({ length: OPEN_PROBLEMS.length }, (_, index) => 'a'.repeat(index + 1));
    expect(new Set(ids.map((postId) => problemFor(postId).id)).size).toBe(OPEN_PROBLEMS.length);
    for (const postId of ids) {
      const sequence = problemSequence(postId).map((problem) => problem.id);
      expect(sequence[0]).toBe(problemFor(postId).id);
      expect(new Set(sequence).size).toBe(sequence.length);
      expect(sequence.filter((id) => id === 'p-vs-np')).toHaveLength(1);
      expect(sequence.filter((id) => id === 'riemann')).toHaveLength(1);
      expect(sequence.at(-1)).toBe('naming');
      // 둘 다 더 쉬운 문제로 나오면 리만 가설이 먼저
      if (!['riemann', 'p-vs-np'].includes(sequence[0]!)) expect(sequence.slice(1, 3)).toEqual(['riemann', 'p-vs-np']);
    }
  });

  it('무엇을 내도 통과하지 못하고, 빈 종이와 짧은 증명과 자명하다는 말은 따로 혼냄', () => {
    expect(gradeProof('   ', 0)).toContain('빈 종이');
    expect(gradeProof('이건 자명하다', 0)).toContain('자명하다는 말은 증명이 아닙니다');
    expect(gradeProof('P 와 NP 는 같다', 0)).toContain('너무 짧습니다');
    const long = '가정: 모든 문제는 다항 시간에 검증된다.\n그러므로 다항 시간에 풀린다.\n증명 끝, 여기까지 적으면 충분히 길다.';
    const verdicts = new Set(Array.from({ length: 7 }, (_, attempt) => gradeProof(long, attempt)));
    expect(verdicts.size).toBe(7);
    expect(gradeProof(long, 0)).toMatch(/^Lean 4 로 검증했습니다\. [1-3]번째 줄/);
  });
});
