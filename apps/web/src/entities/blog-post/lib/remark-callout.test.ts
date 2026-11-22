import { describe, expect, it } from 'vitest';
import { remarkCallout } from './remark-callout';

const quote = (value: string) => ({ type: 'root', children: [{ type: 'blockquote', children: [{ type: 'paragraph', children: [{ type: 'text', value }] }] }] });

describe('노션 콜아웃처럼 쓰는 인용', () => {
  it('이모지로 시작하는 인용은 이모지를 떼어 콜아웃 상자로 바꿈', () => {
    const tree = quote('💡 인증은 너 누구야');
    remarkCallout()(tree);
    const block = tree.children[0]!;
    expect(block).toMatchObject({ data: { hName: 'aside', hProperties: { dataIcon: '💡' } } });
    expect(block.children[0]!.children[0]!.value).toBe('인증은 너 누구야');
  });

  it('여러 글자로 된 이모지도 하나로 보고, 이모지 없는 인용은 그대로 둠', () => {
    const tree = quote('👉🏻 자세히');
    remarkCallout()(tree);
    expect(tree.children[0]).toMatchObject({ data: { hProperties: { dataIcon: '👉🏻' } } });
    const plain = quote('그냥 인용');
    remarkCallout()(plain);
    expect(plain.children[0]).not.toHaveProperty('data');
  });
});
