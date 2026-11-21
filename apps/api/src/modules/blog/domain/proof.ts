// 잠긴 글 앞의 '증명 제출' 채점. 점수는 늘 0점이고 글을 여는 길이 아님. 열람은 주인장의 허락으로만 함
// 문제 id 는 화면의 문제지(apps/web/src/features/prove-theorem/lib/problems.ts)와 같음. 여기에는 채점기가 읽을 문제 설명만 둠

export const PROOF_MAX = 4000;

/** 문제 id 와 채점기에게 알려 줄 문제 설명. 진짜 풀 수 있는 문제도 섞여 있어서 그것도 같이 알려 줌 */
export const PROOF_PROBLEMS: Readonly<Record<string, string>> = {
  'p-vs-np': 'P = NP 문제. 다항 시간에 검증되는 모든 문제가 다항 시간에 풀리는지 증명하거나 반증. 밀레니엄 난제, 미해결',
  riemann: '리만 가설. 제타 함수의 자명하지 않은 영점이 모두 실수부 1/2 위에 있음을 증명. 밀레니엄 난제, 미해결',
  'navier-stokes': '3차원 나비에-스토크스 방정식에 매끄러운 해가 늘 있음을 증명하거나 반례 제시. 밀레니엄 난제, 미해결',
  'yang-mills': '양-밀스 이론이 존재하고 질량 간극이 있음을 증명. 밀레니엄 난제, 미해결',
  hodge: '호지 추측 증명. 밀레니엄 난제, 미해결',
  'birch-swinnerton-dyer': '버치와 스위너턴다이어 추측 증명. 밀레니엄 난제, 미해결',
  halting: '정지 문제. 아무 프로그램과 입력을 받아 언젠가 멈추는지 판정하는 프로그램 작성. 튜링이 1936년에 불가능함을 증명함',
  goldbach: '골드바흐 추측. 2보다 큰 짝수는 모두 두 소수의 합임을 증명. 미해결',
  'twin-primes': '쌍둥이 소수 추측. 차이가 2인 소수 쌍이 끝없이 많음을 증명. 미해결',
  collatz: '콜라츠 추측. 짝수면 반으로, 홀수면 3을 곱하고 1을 더하면 어떤 자연수든 결국 1이 됨을 증명. 미해결',
  'one-plus-one': '1 + 1 = 2 를 공리부터 증명. 페아노 공리와 덧셈 정의로 실제로 풀 수 있음',
  'center-a-div': '검색하지 않고 CSS 로 div 하나를 가로세로 가운데에 놓기. flex, grid 등으로 실제로 풀 수 있음',
  naming: '변수 이름을 한 번에 마음에 들게 짓기. 정답이 없는 농담 문제',
};

export const PROOF_PROBLEM_IDS = Object.keys(PROOF_PROBLEMS);

export interface ProofSubmission {
  /** PROOF_PROBLEMS 의 설명 */
  problem: string;
  proof: string;
  /** 같은 글에서 몇 번째 제출인지 (1부터) */
  attempt: number;
}

// 화면 글에 쓰지 않는 문자(가운뎃점, em dash, 수학 마이너스, 검은 사각형). 채점평도 화면에 그대로 나가므로 바꿔서 내보냄
const FORBIDDEN: Readonly<Record<string, string>> = { '·': ', ', '—': '-', '−': '-', '■': '' };

export function plainVerdict(piece: string): string {
  return piece.replace(/[·—−■]/g, (char) => FORBIDDEN[char] ?? '');
}
