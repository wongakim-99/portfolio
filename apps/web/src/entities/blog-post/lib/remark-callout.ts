// 노션 콜아웃처럼 쓰는 인용: '> 💡 내용' 처럼 이모지로 시작하는 인용은 이모지를 머리에 단 상자(aside)로 그림
// remark 플러그인. 마크다운 나무(mdast)에서 인용을 찾아 맨 앞 이모지를 떼어 data-icon 에 옮김

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

const LEADING_EMOJI = /^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u;

function markCallout(quote: MdNode) {
  const text = quote.children?.[0]?.type === 'paragraph' ? quote.children[0].children?.[0] : undefined;
  if (text?.type !== 'text' || !text.value) return;
  const match = LEADING_EMOJI.exec(text.value);
  if (!match) return;
  text.value = text.value.slice(match[0].length);
  quote.data = { ...quote.data, hName: 'aside', hProperties: { className: ['md-callout'], dataIcon: match[1] } };
}

function walk(node: MdNode) {
  if (node.type === 'blockquote') markCallout(node);
  node.children?.forEach(walk);
}

export function remarkCallout() {
  return (tree: MdNode) => walk(tree);
}
