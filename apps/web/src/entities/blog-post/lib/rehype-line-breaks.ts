// 표 칸 안 줄바꿈: GFM 표는 칸 안에서 줄을 바꿀 때 <br> 로만 쓸 수 있고, 글쓰기 편집기도 칸 안 줄바꿈을 <br> 로 저장함
// rehype 플러그인. 글 안 HTML 은 그리지 않는데(react-markdown 기본) <br> 하나만 진짜 줄바꿈으로 바꿈

interface HtmlNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HtmlNode[];
}

const LINE_BREAK = /^<br\s*\/?>$/i;

function walk(node: HtmlNode) {
  node.children?.forEach((child, i) => {
    if (child.type === 'raw' && LINE_BREAK.test(child.value?.trim() ?? '')) {
      node.children![i] = { type: 'element', tagName: 'br', properties: {}, children: [] };
    } else {
      walk(child);
    }
  });
}

export function rehypeLineBreaks() {
  return (tree: HtmlNode) => walk(tree);
}
