import { describe, expect, it } from 'vitest';
import { continueList, insertBlock, prefixLines, wrap } from './markdown-edit';

describe('글쓰기 마크다운 고치기', () => {
  it('고른 글을 감싸고, 다시 누르면 벗기고, 고른 게 없으면 자리 글을 넣어 고름', () => {
    expect(wrap('인증과 인가', 0, 2, '**', '**', '굵은 글')).toEqual({ text: '**인증**과 인가', start: 2, end: 4 });
    expect(wrap('**인증**과 인가', 2, 4, '**', '**', '굵은 글')).toEqual({ text: '인증과 인가', start: 0, end: 2 });
    expect(wrap('글 ', 2, 2, '[', '](https://)', '링크 글')).toEqual({ text: '글 [링크 글](https://)', start: 3, end: 7 });
  });

  it('고른 줄마다 기호를 붙이고, 다른 기호는 바꾸고, 모두 같으면 뗌. 번호 목록은 차례로 매김', () => {
    expect(prefixLines('하나\n둘', 0, 4, '- ')).toEqual({ text: '- 하나\n- 둘', start: 0, end: 8 });
    expect(prefixLines('- 하나\n- 둘', 0, 9, '- ').text).toBe('하나\n둘');
    expect(prefixLines('## 제목', 3, 3, '# ').text).toBe('# 제목');
    expect(prefixLines('가\n나\n다', 0, 5, '1. ').text).toBe('1. 가\n2. 나\n3. 다');
    expect(prefixLines('> 💡 메모', 0, 0, '- ').text).toBe('- 메모');
  });

  it('덩어리는 앞뒤에 빈 줄을 두고 넣고 커서를 안쪽에 둠', () => {
    expect(insertBlock('위 글', 3, '```\n\n```', 4)).toEqual({ text: '위 글\n\n```\n\n```', start: 9, end: 9 });
    expect(insertBlock('', 0, '---')).toEqual({ text: '---', start: 3, end: 3 });
    expect(insertBlock('앞\n\n뒤', 3, '---').text).toBe('앞\n\n---\n\n뒤');
  });

  it('목록 줄에서 Enter 를 누르면 기호를 이어 붙이고, 빈 항목이면 목록을 끝냄', () => {
    expect(continueList('- 하나', 4)).toEqual({ text: '- 하나\n- ', start: 7, end: 7 });
    expect(continueList('3. 셋', 4)?.text).toBe('3. 셋\n4. ');
    expect(continueList('- [x] 끝', 7)?.text).toBe('- [x] 끝\n- [ ] ');
    expect(continueList('- 하나\n- ', 7)).toEqual({ text: '- 하나\n', start: 5, end: 5 });
    expect(continueList('그냥 글', 4)).toBeNull();
  });
});
