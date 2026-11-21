// apps/api/src/blog/blog.service.ts 의 관리 응답 모양 (blog:grant 권한)

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
