// Google 은 한글 글꼴을 글자 범위별로 90여 조각으로 잘라 내보냄. 처음 쓰는 글자는 그 조각이 올 때까지 대신 글꼴로 보였다가 바뀌어서
// 직접 글을 써 넣는 칸은 자주 쓰는 한글 2350자(KS X 1001)와 자모, 영문 숫자가 든 조각을 미리 받아 둠. 한 번 받으면 브라우저가 오래 캐시함
const warmed = new Set<string>();

function commonText(): string {
  const bytes: number[] = [];
  for (let lead = 0xb0; lead <= 0xc8; lead += 1) for (let trail = 0xa1; trail <= 0xfe; trail += 1) bytes.push(lead, trail);
  const jamo = Array.from({ length: 0x3163 - 0x3131 + 1 }, (_, index) => String.fromCharCode(0x3131 + index)).join('');
  return `${new TextDecoder('euc-kr').decode(new Uint8Array(bytes))}${jamo}abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`;
}

/** family 는 CSS 의 글꼴 이름 그대로. 같은 글꼴은 한 번만 받음 */
export function warmFont(family: string): void {
  if (warmed.has(family) || typeof document === 'undefined' || !document.fonts) return;
  warmed.add(family);
  document.fonts.load(`16px "${family}"`, commonText()).catch(() => warmed.delete(family));
}
