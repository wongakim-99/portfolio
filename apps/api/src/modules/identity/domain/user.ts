import { permissionsOf, type Permission, type Role } from './role.js';
import { avatarUrl } from './avatar.js';

/** 피드, 블로그가 같이 쓰는 회원 계정 */
export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  bio: string;
  /** 사진 저장소 avatars/ 아래 파일 이름 */
  avatar: string | null;
  verifiedAt: Date | null;
  /** 마지막으로 로그인(세션을 연) 시각. 2026-11-22 전에는 적지 않아서 비어 있을 수 있음 */
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** 관리실 회원 목록에 보이는 것. 이메일, 가입 확인, 로그인 기록까지 */
export interface MemberRecord {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: Date;
  /** null 이면 가입 확인 메일을 기다리는 중 (하루 뒤 지워짐) */
  verifiedAt: Date | null;
  lastLoginAt: Date | null;
  /** 아직 열려 있는 로그인 세션 수 */
  activeSessions: number;
}

/** 로그인한 사람. 권한은 요청마다 역할에서 다시 계산함 */
export interface Identity {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  permissions: Permission[];
}

/** 다른 영역이 글쓴이, 요청한 사람으로 보여 줄 만큼 */
export interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** 회원 페이지에 보이는 공개 정보 (이메일은 빼고) */
export interface PublicProfile {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: Date;
}

// 페이지는 permissions 로 버튼을 보이거나 숨기기만 하고, 실제 허용 여부는 서버가 요청마다 다시 확인함
export function toIdentity(user: Pick<User, 'id' | 'email' | 'name' | 'avatar' | 'role'>): Identity {
  const role = user.role ?? 'member';
  return { id: user.id, email: user.email, name: user.name, avatarUrl: avatarUrl(user.avatar), role, permissions: permissionsOf(role) };
}

export const toPerson = (user: Pick<User, 'id' | 'name' | 'avatar'>): Person => ({ id: user.id, name: user.name, avatarUrl: avatarUrl(user.avatar) });

export const toPublicProfile = (user: Pick<User, 'id' | 'name' | 'bio' | 'avatar' | 'role' | 'createdAt'>): PublicProfile => ({
  id: user.id, name: user.name, bio: user.bio ?? '', avatarUrl: avatarUrl(user.avatar), role: user.role ?? 'member', createdAt: user.createdAt,
});
