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
  createdAt: Date;
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
