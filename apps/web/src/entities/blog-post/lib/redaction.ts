// 잠긴 글 카드에서 본문 자리를 지우는 줄 모양. 글 ID 로 정해서 카드마다 다르고, 다시 그려도 같음
// 진짜 본문은 받지 않으므로 줄 길이는 글 내용과 상관없음

const LINES = 3;

/** 글 ID 를 씨앗으로 쓰는 작은 난수 (mulberry32) */
function seeded(seed: string) {
  let state = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 2654435761) >>> 0, 2166136261);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 줄마다 낱말처럼 끊긴 막대 폭(%). 마지막 줄은 문단 끝처럼 짧게 */
export function redactedLines(seed: string): number[][] {
  const random = seeded(seed);
  return Array.from({ length: LINES }, (_, line) => {
    const total = line === LINES - 1 ? 38 + random() * 28 : 82 + random() * 18;
    const count = 2 + Math.floor(random() * 3);
    const weights = Array.from({ length: count }, () => 0.6 + random());
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((weight) => Math.round((weight / sum) * total));
  });
}
