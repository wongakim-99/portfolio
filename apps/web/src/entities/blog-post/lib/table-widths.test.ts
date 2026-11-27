import { describe, expect, it } from 'vitest';
import { rehypeTableWidths } from './rehype-table-widths';
import { parseTableWidths, tableWidthsComment } from './table-widths';

type Node = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[] };
const el = (tagName: string, children: Node[] = []): Node => ({ type: 'element', tagName, properties: {}, children });
const table = (cols: number) => el('table', [el('thead', [el('tr', Array.from({ length: cols }, () => el('th')))])]);

describe('표 칸 너비 주석', () => {
  it('주석을 쓰고 읽음. 다른 주석이나 글은 너비가 아님', () => {
    expect(tableWidthsComment([120.4, 300, 160])).toBe('<!-- widths: 120 300 160 -->');
    expect(parseTableWidths('<!-- widths: 120 300 160 -->')).toEqual([120, 300, 160]);
    expect(parseTableWidths('  <!--widths:80 90-->\n')).toEqual([80, 90]);
    expect(parseTableWidths('<!-- 그냥 주석 -->')).toBeNull();
    expect(parseTableWidths('<!-- widths: 120 abc -->')).toBeNull();
  });

  it('읽는 화면은 칸 수가 맞으면 표에 너비를 달고 주석은 지움', () => {
    const tree = el('root', [{ type: 'raw', value: '<!-- widths: 100 200 -->' }, { type: 'text', value: '\n' }, table(2)]);
    rehypeTableWidths()(tree);
    expect(tree.children).toHaveLength(2);
    const sized = tree.children![1]!;
    expect(sized.properties).toMatchObject({ style: 'table-layout: fixed; width: 300px' });
    expect(sized.children![0]).toMatchObject({ tagName: 'colgroup', children: [{ properties: { style: 'width: 100px' } }, { properties: { style: 'width: 200px' } }] });
  });

  it('칸 수가 다르거나 뒤에 표가 없으면 너비는 버리고 주석만 지움', () => {
    const tree = el('root', [{ type: 'raw', value: '<!-- widths: 100 200 300 -->' }, table(2), { type: 'raw', value: '<!-- widths: 50 -->' }, el('p')]);
    rehypeTableWidths()(tree);
    expect(tree.children!.map((node) => node.tagName)).toEqual(['table', 'p']);
    expect(tree.children![0]!.properties).toEqual({});
  });
});
