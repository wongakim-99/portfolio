// 역할 기반 권한(RBAC). 할 수 있는 일(권한)을 역할마다 묶어 두고, 회원 문서에는 역할만 적음
// 권한은 요청마다 DB 의 역할에서 다시 계산하므로 역할을 바꾸면 이미 로그인한 세션에도 바로 반영됨
// 내 글만 고치고 지우는 규칙은 역할이 아니라 글쓴이가 누구인지로 따짐 (CommunityPostsService)
// owner 는 사이트 주인 한 사람. 관리자 권한에 더해 블로그 글쓰기와 열람 허락을 가짐
export const ROLES = ['member', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'messages:read' // 홈 엽서로 받은 쪽지 보기
  | 'messages:delete'
  | 'reports:read' // 피드 신고 보기
  | 'reports:dismiss'
  | 'content:moderate' // 남의 글과 댓글 삭제 (수정은 못 함)
  | 'server:read' // 관리실의 실시간 서버 토폴로지
  | 'blog:write' // 블로그 글 쓰기, 고치기, 지우기. 모든 공개 범위의 글을 읽음
  | 'blog:grant'; // 블로그 열람 요청을 허락, 거절하고 허락을 거둠

const ADMIN: readonly Permission[] = ['messages:read', 'messages:delete', 'reports:read', 'reports:dismiss', 'content:moderate', 'server:read'];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  member: [],
  admin: ADMIN,
  owner: [...ADMIN, 'blog:write', 'blog:grant'],
};

export function permissionsOf(role?: string | null): Permission[] {
  return [...(ROLE_PERMISSIONS[role as Role] ?? ROLE_PERMISSIONS.member)];
}
