import { describe, expect, it } from 'vitest';
import { loneVideoId, type ParagraphNode } from './lone-video';

const text = (value: string): ParagraphNode => ({ type: 'text', value });
const link = (href: string, label = href): ParagraphNode => ({ type: 'element', tagName: 'a', properties: { href }, children: [text(label)] });
const paragraph = (...children: ParagraphNode[]): ParagraphNode => ({ type: 'element', tagName: 'p', children });

describe('loneVideoId', () => {
  it('유튜브 링크만 있는 문단은 영상 ID 를 돌려줌 (쇼츠, 공유 주소, 제목 붙인 링크)', () => {
    expect(loneVideoId(paragraph(link('https://youtube.com/shorts/IApB79lPVpg?si=sKBk-HZT7UstvrBK')))).toBe('IApB79lPVpg');
    expect(loneVideoId(paragraph(link('https://youtu.be/dQw4w9WgXcQ', '좋아하는 영상')))).toBe('dQw4w9WgXcQ');
    expect(loneVideoId(paragraph(text(' '), link('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { type: 'element', tagName: 'br' }))).toBe('dQw4w9WgXcQ');
  });

  it('문장에 섞인 링크, 링크 두 개, 유튜브가 아닌 링크는 카드로 바꾸지 않음', () => {
    expect(loneVideoId(paragraph(text('이 영상 '), link('https://youtu.be/dQw4w9WgXcQ'), text(' 을 봤다')))).toBeNull();
    expect(loneVideoId(paragraph(link('https://youtu.be/dQw4w9WgXcQ'), link('https://youtu.be/AAAAAAAAAAA')))).toBeNull();
    expect(loneVideoId(paragraph(link('https://example.com/watch?v=dQw4w9WgXcQ')))).toBeNull();
    expect(loneVideoId(paragraph(text('그냥 글')))).toBeNull();
    expect(loneVideoId(undefined)).toBeNull();
  });
});
