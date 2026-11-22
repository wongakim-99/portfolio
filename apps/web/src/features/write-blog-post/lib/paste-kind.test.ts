import { describe, expect, it } from 'vitest';
import { looksLikeMarkdown, vscodeLanguage } from './paste-kind';

describe('looksLikeMarkdown', () => {
  it('줄 맨 앞의 제목, 목록, 인용, 코드, 표를 마크다운으로 봄', () => {
    expect(looksLikeMarkdown('# 제목\n본문')).toBe(true);
    expect(looksLikeMarkdown('앞 글\n- 하나\n- 둘')).toBe(true);
    expect(looksLikeMarkdown('> 💡 콜아웃')).toBe(true);
    expect(looksLikeMarkdown('```ts\nconst a = 1;\n```')).toBe(true);
    expect(looksLikeMarkdown('| a | b |\n| --- | --- |')).toBe(true);
  });

  it('글 안의 굵게, 인라인 코드, 링크, 사진도 마크다운으로 봄', () => {
    expect(looksLikeMarkdown('이건 **중요**')).toBe(true);
    expect(looksLikeMarkdown('`npm test` 를 돌림')).toBe(true);
    expect(looksLikeMarkdown('[문서](https://example.com)')).toBe(true);
  });

  it('그냥 글, 해시태그, 빈 글은 그대로 붙임', () => {
    expect(looksLikeMarkdown('그냥 한 줄 글')).toBe(false);
    expect(looksLikeMarkdown('#해시태그 붙은 글')).toBe(false);
    expect(looksLikeMarkdown('곱하기 2 * 3 = 6')).toBe(false);
    expect(looksLikeMarkdown('   ')).toBe(false);
  });
});

describe('vscodeLanguage', () => {
  it('VS Code 가 보낸 언어 이름을 꺼내고, 그냥 글이나 깨진 값이면 없음', () => {
    expect(vscodeLanguage('{"version":1,"mode":"typescript"}')).toBe('typescript');
    expect(vscodeLanguage('{"version":1,"mode":"plaintext"}')).toBeNull();
    expect(vscodeLanguage('not json')).toBeNull();
  });
});
