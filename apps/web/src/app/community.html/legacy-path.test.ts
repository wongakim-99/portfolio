import { describe, expect, it } from 'vitest';
import { legacyFeedPath } from './legacy-path';

const path = (search: string) => legacyFeedPath(new URLSearchParams(search));

describe('예전 피드 주소', () => {
  it('쿼리마다 지금 화면으로 보냄', () => {
    expect(path('')).toBe('/feed');
    expect(path('?post=6650a1')).toBe('/feed/posts/6650a1');
    expect(path('?user=6650b2')).toBe('/feed/users/6650b2');
    expect(path('?edit=6650a1')).toBe('/feed/posts/6650a1/edit');
    expect(path('?admin=1')).toBe('/feed/admin');
    // 긴 글 쓰기 화면은 없어서 피드 첫 화면(맨 위 쓰기 칸)으로
    expect(path('?write=1')).toBe('/feed');
  });

  it('ID 는 주소에 안전하게 넣고, 빈 값이면 피드 첫 화면', () => {
    expect(path('?post=a%2Fb')).toBe('/feed/posts/a%2Fb');
    expect(path('?post=')).toBe('/feed');
  });
});
