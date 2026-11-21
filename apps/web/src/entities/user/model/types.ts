// apps/api/src/community 의 응답 모양

export type Permission = 'messages:read' | 'messages:delete' | 'reports:read' | 'reports:dismiss' | 'content:moderate' | 'server:read';
export type Role = 'member' | 'admin';

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
