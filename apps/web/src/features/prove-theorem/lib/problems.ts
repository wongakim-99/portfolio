// 잠긴 블로그 글의 '증명하시면 볼 수 있습니다' 문제와 채점. 무엇을 적어 내든 통과하지 못함
// 화면에 보이는 글이라 가운뎃점, em dash 같은 금지 문자를 쓰지 않음 (scripts/portfolio-pdf.test.mjs)

export interface Problem {
  id: string;
  ask: string;
  note: string;
}

// 글마다 처음 내는 문제. 글 ID 로 골라서 새로고침해도 같은 문제가 나옴
export const OPEN_PROBLEMS: readonly Problem[] = [
  {
    id: 'p-vs-np',
    ask: 'P = NP 를 증명하시면 이 글을 볼 수 있습니다.',
    note: 'P ≠ NP 를 증명하셔도 됩니다. 어느 쪽이든 클레이 수학연구소 상금 100만 달러는 덤입니다.',
  },
  {
    id: 'riemann',
    ask: '리만 가설을 증명하시면 이 글을 볼 수 있습니다.',
    note: '제타 함수의 자명하지 않은 영점이 모두 실수부 1/2 위에 있다는 것만 보이시면 됩니다. 1859년부터 다들 기다리는 중입니다.',
  },
  {
    id: 'navier-stokes',
    ask: '3차원 나비에-스토크스 방정식에 매끄러운 해가 늘 있음을 증명하시면 이 글을 볼 수 있습니다.',
    note: '커피를 저을 때마다 떠오르는 문제입니다. 반례를 찾으셔도 인정해 드립니다.',
  },
  {
    id: 'yang-mills',
    ask: '양-밀스 이론에 질량 간극이 있음을 증명하시면 이 글을 볼 수 있습니다.',
    note: '물리학과 친구에게 물어보셔도 됩니다. 그 친구도 모를 겁니다.',
  },
  {
    id: 'hodge',
    ask: '호지 추측을 증명하시면 이 글을 볼 수 있습니다.',
    note: '문제를 이해하는 데만 대학원 2년이 걸린다는 소문이 있습니다.',
  },
  {
    id: 'birch-swinnerton-dyer',
    ask: '버치와 스위너턴다이어 추측을 증명하시면 이 글을 볼 수 있습니다.',
    note: '타원곡선 하나 골라서 시작하시면 됩니다. 어디서 끝나는지는 아무도 모릅니다.',
  },
  {
    id: 'halting',
    ask: '아무 프로그램이나 받아서 언젠가 멈추는지 알려 주는 프로그램을 짜 오시면 이 글을 볼 수 있습니다.',
    note: '튜링이 1936년에 안 된다고 증명해 뒀습니다. 그래도 해 보시겠다면 말리지 않겠습니다.',
  },
];

// '더 쉬운 문제 주세요' 를 누를 때마다 차례로 냄. 쉬워 보이지만 하나도 안 쉬움. 다 지나면 요청하기로 보냄
export const EASIER_PROBLEMS: readonly Problem[] = [
  {
    id: 'goldbach',
    ask: '그럼 2보다 큰 짝수는 모두 두 소수의 합이라는 것만 증명해 주세요.',
    note: '4 = 2 + 2, 6 = 3 + 3, 8 = 3 + 5. 이렇게 끝까지 가시면 됩니다. 끝이 없다는 게 문제지만요.',
  },
  {
    id: 'twin-primes',
    ask: '차이가 2인 소수 쌍(3과 5, 11과 13)이 끝없이 많다는 것만 보여 주세요.',
    note: '누군가 그 간격을 7천만까지 줄여 놨고, 지금은 246 까지 왔습니다. 2까지만 더 줄이시면 됩니다.',
  },
  {
    id: 'collatz',
    ask: '짝수면 반으로 나누고 홀수면 3을 곱해 1을 더하기를 되풀이하면, 어떤 자연수든 결국 1이 된다는 것만 증명해 주세요.',
    note: '초등학생도 이해하는 문제입니다. 에르되시는 수학이 아직 이런 문제를 다룰 준비가 안 됐다고 했습니다.',
  },
  {
    id: 'one-plus-one',
    ask: '그럼 1 + 1 = 2 를 공리부터 증명해 주세요.',
    note: '드디어 풀린 문제입니다. 러셀과 화이트헤드는 수백 쪽 만에 해냈습니다.',
  },
  {
    id: 'center-a-div',
    ask: '검색하지 않고 CSS 로 div 하나를 가로세로 가운데에 놓아 주세요.',
    note: '거의 다 왔습니다. 많은 개발자가 여기서 무너졌습니다.',
  },
  {
    id: 'naming',
    ask: '마지막입니다. 변수 이름을 한 번에 마음에 들게 지어 주세요.',
    note: '컴퓨터 과학에서 어려운 문제 두 개 중 하나입니다. 나머지 하나는 캐시 무효화입니다.',
  },
];

function seedOf(postId: string): number {
  return [...postId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function problemFor(postId: string): Problem {
  return OPEN_PROBLEMS[seedOf(postId) % OPEN_PROBLEMS.length] ?? OPEN_PROBLEMS[0]!;
}

// 제대로 길게 써 내면 돌아가며 나오는 채점평. line 은 지적할 줄 번호
const VERDICTS: readonly ((line: number) => string)[] = [
  (line) => `Lean 4 로 검증했습니다. ${line}번째 줄에 sorry 가 남아 있습니다.`,
  () => '심사위원 2번이 major revision 을 요청했습니다. 심사위원 2번은 늘 그럽니다.',
  () => '여백이 좁아서 다 못 적으셨군요. 페르마도 그랬습니다.',
  (line) => `${line}번째 줄에서 0 으로 나누셨습니다.`,
  () => '결론을 가정에 슬쩍 넣으셨습니다. 순환 논리입니다.',
  () => '반례를 찾았습니다. 여백이 좁아 적지는 않겠습니다.',
  () => '클레이 수학연구소에 먼저 보내 주세요. 상금을 받으시면 이 글은 그냥 보여 드리겠습니다.',
];

/** attempt 는 몇 번째 제출인지(0부터). 같은 글에서 낼 때마다 다른 채점평이 돌아가며 나옴 */
export function gradeProof(proof: string, attempt: number, postId = ''): string {
  const text = proof.trim();
  if (!text) return '빈 종이입니다. 자명하다고 하시려면 그 말이라도 적어 주세요.';
  if (/자명|trivial|obvious/i.test(text)) return '자명하다는 말은 증명이 아닙니다. 수학과 1학년 때 다들 한 번씩 혼나는 말입니다.';
  if (text.length < 40) return '증명이 너무 짧습니다. 와일스는 페르마의 마지막 정리를 100쪽 넘게 썼습니다.';
  const lines = text.split('\n').length;
  const verdict = VERDICTS[(seedOf(postId) + attempt) % VERDICTS.length] ?? VERDICTS[0]!;
  return verdict(((attempt * 7) % lines) + 1);
}
