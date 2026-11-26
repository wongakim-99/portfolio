import { describe, expect, it } from 'vitest';
import { rehypeLineBreaks } from './rehype-line-breaks';

type Node = { type: string; value?: string; tagName?: string; children?: Node[] };
const cell = (...children: Node[]) => ({ type: 'root', children: [{ type: 'element', tagName: 'td', children }] });

describe('표 칸 안 줄바꿈', () => {
  it('<br> 은 줄바꿈으로 바꿈 (<br/>, <BR /> 도)', () => {
    for (const value of ['<br>', '<br/>', '<BR />']) {
      const tree = cell({ type: 'text', value: '위 줄' }, { type: 'raw', value }, { type: 'text', value: '아래 줄' });
      rehypeLineBreaks()(tree);
      expect(tree.children[0]!.children[1]).toEqual({ type: 'element', tagName: 'br', properties: {}, children: [] });
    }
  });

  it('다른 HTML 은 그대로 둠 (react-markdown 이 글자로 보여 줌)', () => {
    const tree = cell({ type: 'raw', value: '<script>alert(1)</script>' }, { type: 'raw', value: '<br onclick="x">' });
    rehypeLineBreaks()(tree);
    expect(tree.children[0]!.children).toEqual([{ type: 'raw', value: '<script>alert(1)</script>' }, { type: 'raw', value: '<br onclick="x">' }]);
  });
});
