// 로키는 화음으로 말함. 대사마다 짧은 화음 몇 개를 브라우저에서 직접 합성해서 들려줌 (영화 소리는 쓰지 않음)
// 대사는 이 사이트가 직접 쓴 것. 로키 말투를 따라 물음은 끝에 '질문?' 을 붙임

export const ROCKY_LINES: readonly string[] = [
  '너 블로그 읽는다. 좋다 좋다 좋다.',
  '잠긴 글 못 연다, 질문? 나도 못 연다.',
  '증명 어렵다. 리만 가설, 나 모른다. 그레이스도 모른다.',
  '이 책상 넓다. 굴러다니기 좋다.',
  '주먹 맞대기. 너 주먹, 내 주먹.',
  '놀랍다! 놀랍다! 놀랍다!',
  '공 안은 210도. 따뜻하다. 너 춥다, 질문?',
  '나 공 잡아도 된다. 던져도 된다. 살살.',
];

/** 말풍선의 '주먹 맞대기' 를 눌렀을 때 */
export const BUMP_LINE = '주먹 맞대기! 좋다 좋다 좋다.';

/** 세게 던져서 공 안에서 같이 굴렀을 때. 돌아가며 나옴 */
export const DIZZY_LINES: readonly string[] = [
  '빙글빙글. 놀랍다. 다시는 하지 마라, 질문?',
  '세상이 돈다. 공도 돈다. 나도 돈다.',
  '너 힘 세다. 나 어지럽다. 좋지 않다.',
];

// A 단조 5음 음계. 어떻게 골라도 서로 거슬리지 않음
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

/** 대사 한 줄을 화음 몇 개로. 낱말 두 개에 화음 하나, 2~4개. 같은 대사는 늘 같은 소리 */
export function chordsFor(line: string): number[][] {
  const words = line.split(/\s+/).filter(Boolean).length;
  const count = Math.min(4, Math.max(2, Math.round(words / 2)));
  let seed = [...line].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);
  const next = () => {
    seed = (seed * 48271) % 2147483647;
    return seed;
  };
  return Array.from({ length: count }, () => {
    const root = next() % (SCALE.length - 4);
    return [SCALE[root]!, SCALE[root + 2]!, SCALE[root + 4]!];
  });
}
