import { firstImage, imagesIn, plainText } from '../src/modules/blog/domain/blog-image.js';

describe('블로그 본문 마크다운', () => {
  const a = '/api/blog/images/aaaaaaaaaaaaaaaaaaaaaaaa.webp';
  const b = '/api/blog/images/bbbbbbbbbbbbbbbbbbbbbbbb.jpg';

  it('본문과 표지에서 블로그 사진 파일을 나온 순서대로 겹치지 않게 찾음', () => {
    const body = `![하나](${a})\n텍스트 ${b} 그리고 다시 ![하나](${a})\n![밖](https://example.com/x.png)`;
    expect(imagesIn(body)).toEqual(['aaaaaaaaaaaaaaaaaaaaaaaa.webp', 'bbbbbbbbbbbbbbbbbbbbbbbb.jpg']);
    expect(imagesIn(body, 'cccccccccccccccccccccccc.png')[0]).toBe('cccccccccccccccccccccccc.png');
    expect(firstImage('사진 없는 글')).toBeNull();
  });

  it('미리보기 글에서는 마크다운 기호, 사진, 링크 주소, 표 줄을 걷어냄', () => {
    const body = [
      '# 인증과 인가',
      '> 💡 **인증**은 너 누구야, `인가`는 해도 돼?',
      '- [x] 끝낸 일',
      '1. 첫째',
      `![사진](${a})`,
      '| 상태 | 뜻 |',
      '| --- | --- |',
      '| 401 | 인증 안 됨 |',
      '[노션 링크](https://notion.so)',
      '```ts',
      'const role = "owner";',
      '```',
    ].join('\n');
    expect(plainText(body)).toBe('인증과 인가 💡 인증은 너 누구야, 인가는 해도 돼? 끝낸 일 첫째 상태 뜻 401 인증 안 됨 노션 링크 const role = "owner";');
  });

  it('기울임 뒤에 조사나 문장부호가 붙어도 걷어내고, 편집기가 쓴 이스케이프와 빈 줄 표기는 글자로 되돌림', () => {
    expect(plainText('*기울임*, *기울임*과 _밑줄 기울임_ 끝')).toBe('기울임, 기울임과 밑줄 기울임 끝');
    expect(plainText('곱하기 2 * 3 * 4 와 snake_case_name')).toBe('곱하기 2 * 3 * 4 와 snake_case_name');
    expect(plainText('\\*별표\\* 와 &lt;b&gt;태그&lt;/b&gt;\n\n&nbsp;\n\n다음 줄')).toBe('*별표* 와 <b>태그</b> 다음 줄');
  });
});
