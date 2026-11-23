import { describe, expect, it } from 'vitest';
import { linkParts, linkPreview, youtubeIdIn } from './links';

describe('글 속 링크', () => {
  it('http(s) 주소만 링크로 떼고 끝에 붙은 문장부호는 글자로 남김', () => {
    expect(linkParts('여기 https://example.com/a?b=1. 그리고 (http://x.dev/y)')).toEqual([
      { text: '여기 ' },
      { text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { text: '. 그리고 (' },
      { text: 'http://x.dev/y', href: 'http://x.dev/y' },
      { text: ')' },
    ]);
    expect(linkParts('javascript:alert(1) 는 링크가 아님')).toEqual([{ text: 'javascript:alert(1) 는 링크가 아님' }]);
  });

  it('유튜브 영상 주소 여러 모양에서 영상 ID 를 찾음', () => {
    expect(youtubeIdIn('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeIdIn('봐요 https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
    expect(youtubeIdIn('https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeIdIn('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeIdIn('https://www.youtube.com/channel/UCabc')).toBeNull();
    expect(youtubeIdIn('https://youtu.be/short')).toBeNull();
  });

  it('링크 칸 주소는 http(s) 만 카드로 바꾸고 사이트 이름의 www. 는 뺌', () => {
    expect(linkPreview(' https://www.example.com/a?b=1 ')).toEqual({ url: 'https://www.example.com/a?b=1', host: 'example.com' });
    expect(linkPreview('javascript:alert(1)')).toBeNull();
    expect(linkPreview('example.com')).toBeNull();
    expect(linkPreview('https://')).toBeNull();
  });
});
