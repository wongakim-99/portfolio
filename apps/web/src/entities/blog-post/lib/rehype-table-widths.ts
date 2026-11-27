import { parseTableWidths } from './table-widths';

// 글쓰기에서 칸 경계를 끌어 정한 표 너비를 읽는 화면에도 그대로 그림
// rehype 플러그인. 표 바로 앞의 너비 주석(<!-- widths: ... -->)을 읽어 칸 너비를 달고 주석은 지움 (그냥 두면 글자로 보임)

interface HtmlNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HtmlNode[];
}

const isBlank = (node: HtmlNode) => node.type === 'text' && !node.value?.trim();

function columnCount(table: HtmlNode): number {
  const row = (function first(node: HtmlNode): HtmlNode | undefined {
    if (node.tagName === 'tr') return node;
    for (const child of node.children ?? []) {
      const found = first(child);
      if (found) return found;
    }
    return undefined;
  })(table);
  return row?.children?.filter((cell) => cell.tagName === 'th' || cell.tagName === 'td').length ?? 0;
}

function sizeTable(table: HtmlNode, widths: number[]) {
  const total = widths.reduce((sum, width) => sum + width, 0);
  table.properties = { ...table.properties, style: `table-layout: fixed; width: ${total}px` };
  const cols = widths.map((width) => ({ type: 'element', tagName: 'col', properties: { style: `width: ${width}px` }, children: [] }));
  table.children = [{ type: 'element', tagName: 'colgroup', properties: {}, children: cols }, ...(table.children ?? [])];
}

function walk(node: HtmlNode) {
  const children = node.children;
  if (!children) return;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]!;
    const widths = child.type === 'raw' ? parseTableWidths(child.value ?? '') : null;
    if (!widths) {
      walk(child);
      continue;
    }
    let next = i + 1;
    while (next < children.length && isBlank(children[next]!)) next += 1;
    const table = children[next];
    // 칸 수가 맞을 때만 너비를 달고, 주석은 어느 쪽이든 지움
    if (table?.tagName === 'table' && columnCount(table) === widths.length) sizeTable(table, widths);
    children.splice(i, 1);
    i -= 1;
  }
}

export function rehypeTableWidths() {
  return (tree: HtmlNode) => walk(tree);
}
