// apps/api/src/modules/identity 와 feed(회원 페이지)의 응답 모양

export type Permission =
  | 'messages:read'
  | 'messages:delete'
  | 'reports:read'
  | 'reports:dismiss'
  | 'content:moderate'
  | 'server:read'
  | 'blog:write'
  | 'blog:grant'
  | 'members:read'
  | 'members:role';
/** owner 는 사이트 주인. 관리자 권한에 블로그 글쓰기와 열람 허락이 더해짐 */
export type Role = 'member' | 'admin' | 'owner';

/** 로그인한 나 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  permissions: Permission[];
}

/** 회원 페이지에 보이는 공개 정보 */
export interface Profile {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
  postCount: number;
  commentCount: number;
}

/** 관리실 회원 목록의 한 사람 (apps/api identity 의 MemberRecord) */
export interface Member {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
  /** null 이면 가입 확인 메일을 기다리는 중 (하루 안에 확인하지 않으면 지워짐) */
  verifiedAt: string | null;
  lastLoginAt: string | null;
  /** 아직 열려 있는 로그인 세션 수 */
  activeSessions: number;
}

/** 작은 프로필 사진에 필요한 만큼 */
export interface Person {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface AuthConfig {
  registrationEnabled: boolean;
  uploadsEnabled: boolean;
}
