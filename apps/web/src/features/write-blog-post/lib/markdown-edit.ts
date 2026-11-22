// 글쓰기 도구 막대와 단축키가 본문 글자를 고치는 방법. 화면을 모르는 순수 함수만 둠
// 모두 고친 글과 고친 뒤 고를 범위(start, end)를 돌려줌

export interface Edit {
  text: string;
  start: number;
  end: number;
}

/** 고른 글을 앞뒤로 감쌈(굵게, 기울임, 링크). 고른 게 없으면 placeholder 를 넣고 그것을 고름. 이미 감싸져 있으면 벗김 */
export function wrap(text: string, start: number, end: number, before: string, after: string, placeholder: string): Edit {
  const inner = text.slice(start, end);
  if (text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after) {
    return { text: text.slice(0, start - before.length) + inner + text.slice(end + after.length), start: start - before.length, end: end - before.length };
  }
  const chosen = inner || placeholder;
  const next = text.slice(0, start) + before + chosen + after + text.slice(end);
  return { text: next, start: start + before.length, end: start + before.length + chosen.length };
}

const lineStart = (text: string, at: number) => text.lastIndexOf('\n', at - 1) + 1;
const lineEnd = (text: string, at: number) => {
  const found = text.indexOf('\n', at);
  return found === -1 ? text.length : found;
};
// 줄 앞의 제목, 인용, 목록 기호. 다른 기호로 바꿀 때 먼저 떼어 냄
const MARKER = /^(?:#{1,6} |> (?:\p{Extended_Pictographic}️? )?|- \[[ xX]\] |[-*+] |\d+\. )/u;

/** 고른 줄마다 앞에 기호(제목, 인용, 목록)를 붙임. 모든 줄에 이미 같은 기호가 있으면 뗌 */
export function prefixLines(text: string, start: number, end: number, prefix: string): Edit {
  const from = lineStart(text, start);
  const to = lineEnd(text, end);
  const lines = text.slice(from, to).split('\n');
  const all = lines.every((line) => line.startsWith(prefix));
  const changed = lines.map((line, index) => {
    if (all) return line.slice(prefix.length);
    const bare = line.replace(MARKER, '');
    return (prefix === '1. ' ? `${index + 1}. ` : prefix) + bare;
  });
  const block = changed.join('\n');
  return { text: text.slice(0, from) + block + text.slice(to), start: from, end: from + block.length };
}

/** 코드 블록, 표, 사진처럼 제 줄을 차지하는 덩어리를 넣음. 앞뒤에 빈 줄을 두고 cursor 위치(덩어리 안 글자 번호)에 커서를 둠 */
export function insertBlock(text: string, at: number, block: string, cursor = block.length): Edit {
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const tail = after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const position = before.length + lead.length + cursor;
  return { text: before + lead + block + tail + after, start: position, end: position };
}

/**
 * Enter 를 누른 줄이 목록이면 다음 줄에도 같은 기호를 붙임 (번호는 하나 늘림)
 * 기호만 있는 빈 항목에서 누르면 기호를 지우고 목록을 끝냄. 목록이 아니면 null (평소처럼 줄바꿈)
 */
export function continueList(text: string, at: number): Edit | null {
  const from = lineStart(text, at);
  const line = text.slice(from, at);
  const match = /^(\s*)(- \[[ xX]\] |[-*+] |(\d+)\. |> )/.exec(line);
  if (!match) return null;
  const [marker, indent = '', symbol = '', number] = match;
  if (line.length === marker.length) {
    return { text: text.slice(0, from) + text.slice(at), start: from, end: from };
  }
  const next = indent + (number ? `${Number(number) + 1}. ` : symbol.startsWith('- [') ? '- [ ] ' : symbol);
  const position = at + 1 + next.length;
  return { text: `${text.slice(0, at)}\n${next}${text.slice(at)}`, start: position, end: position };
}
