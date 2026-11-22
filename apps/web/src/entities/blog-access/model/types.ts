// apps/api/src/modules/blog/application/blog-access.service.ts 의 관리 응답 모양 (blog:grant 권한)

interface Requester {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** 아직 답하지 않은 열람 요청 */
export interface AccessRequest {
  id: string;
  message: string;
  createdAt: string;
  user: Requester;
  post: { id: string; title: string };
}

/** 열람 허락. post 가 null 이면 허락한 사람만 보는 글 전부 (앞으로 쓸 글 포함) */
export interface AccessGrant {
  id: string;
  createdAt: string;
  user: Requester;
  post: { id: string; title: string } | null;
}

/** post 는 그 글만, all 은 허락한 사람만 보는 글 전부 */
export type GrantScope = 'post' | 'all';

/** 오늘(한국 시간) 잠긴 글 증명 채점에서 바깥 AI 를 부른 횟수와 하루 한도 (apps/api 의 proof-grading.service.ts) */
export interface ProofUsage {
  day: string;
  total: number;
  limit: number;
  perVisitor: number;
}
