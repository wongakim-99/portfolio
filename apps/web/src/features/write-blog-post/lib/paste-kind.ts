// 붙여넣은 글이 어떤 글인지 가림. 편집기(rich-editor.tsx)가 이걸 보고 바로 바꿔 넣을지 정함

// 마크다운 글로 볼 표시: 줄 맨 앞의 제목, 목록, 인용, 코드 울타리, 표, 할 일, 또는 글 안의 굵게, 링크, 사진
const BLOCK_SYNTAX = /^(?:#{1,6} |[-*+] |\d+\. |> |```|\|.*\|\s*$|[-*] \[[ xX]\] |---\s*$)/m;
const INLINE_SYNTAX = /\*\*[^*\n]+\*\*|`[^`\n]+`|!?\[[^\]\n]+\]\([^)\s]+\)/;

export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false;
  return BLOCK_SYNTAX.test(text) || INLINE_SYNTAX.test(text);
}

// VS Code 가 복사할 때 같이 보내는 언어 이름을 코드 블록 언어로 씀. 그냥 글이면 언어 없음
export function vscodeLanguage(data: string): string | null {
  try {
    const mode = (JSON.parse(data) as { mode?: unknown }).mode;
    return typeof mode === 'string' && mode && mode !== 'plaintext' ? mode : null;
  } catch {
    return null;
  }
}
