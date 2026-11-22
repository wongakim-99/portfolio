import type { Role } from './role.js';
import type { MailTokenKind } from './session.js';
import type { User } from './user.js';

// 계정 영역이 바깥에 기대는 것들. 구현은 infrastructure 에 있고 identity.module.ts 가 이어 붙임
// Nest 가 추상 클래스를 주입 토큰으로 쓰므로 interface 대신 abstract class 로 둠

export abstract class UserRepository {
  /** 확인 기한이 지난 미확인 가입을 지워 같은 주소로 다시 가입할 수 있게 함 */
  abstract deleteExpiredPending(email: string, now: Date): Promise<void>;
  abstract existsByEmail(email: string): Promise<boolean>;
  /** 이미 같은 주소가 있으면 null */
  abstract createPending(input: { email: string; name: string; passwordHash: string; pendingExpiresAt: Date }): Promise<User | null>;
  abstract deleteUnverified(id: string): Promise<void>;
  abstract markVerified(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findPendingByEmail(email: string, now: Date): Promise<User | null>;
  abstract findVerifiedByEmail(email: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
  abstract findVerifiedById(id: string): Promise<User | null>;
  abstract findVerifiedByIds(ids: string[]): Promise<User[]>;
  /** 역할이 owner 인 확인된 회원. 가입이 이른 순 */
  abstract findOwners(): Promise<User[]>;
  abstract setPasswordHash(id: string, passwordHash: string, verifiedOnly?: boolean): Promise<void>;
  abstract updateProfile(id: string, profile: { name: string; bio: string }): Promise<void>;
  abstract setRoleByEmail(email: string, role: Role): Promise<User | null>;
  /** 관리실에서 바꾸는 역할. 확인된 회원만, 주인장(owner)은 건드리지 않음. 못 바꾸면 null */
  abstract setRoleById(id: string, role: Exclude<Role, 'owner'>): Promise<User | null>;
  /** 확인 대기 가입까지 모든 계정. 최근 가입 순 */
  abstract listAll(limit: number): Promise<User[]>;
  abstract touchLogin(id: string, at: Date): Promise<void>;
  /** 바꾸기 전 사진 파일 이름을 돌려줌 */
  abstract setAvatar(id: string, avatar: string | null): Promise<string | null>;
}

export abstract class SessionRepository {
  abstract create(tokenHash: string, userId: string, expiresAt: Date): Promise<void>;
  /** 아직 유효한 세션의 회원 ID */
  abstract findUserId(tokenHash: string, now: Date): Promise<string | null>;
  abstract delete(tokenHash: string): Promise<void>;
  /** exceptTokenHash 를 주면 그 세션만 남김 (비밀번호를 바꾼 지금 창) */
  abstract deleteAllFor(userId: string, exceptTokenHash?: string): Promise<void>;
  /** 회원마다 아직 열린 세션 수와 그중 가장 늦게 끝나는 시각. 로그인 기록이 없는 옛 회원의 마지막 로그인을 어림할 때 씀 */
  abstract activity(userIds: string[], now: Date): Promise<Map<string, { count: number; latestExpiresAt: Date }>>;
}

export abstract class MailTokenRepository {
  /** 같은 종류의 이전 토큰은 지우고 새로 둠 */
  abstract issue(userId: string, kind: MailTokenKind, tokenHash: string, expiresAt: Date): Promise<void>;
  /** 한 번만 씀. 맞는 토큰이면 지우고 회원 ID 를 돌려줌 */
  abstract consume(tokenHash: string, kind: MailTokenKind, now: Date): Promise<string | null>;
  abstract delete(tokenHash: string): Promise<void>;
  abstract issuedSince(userId: string, kind: MailTokenKind, since: Date): Promise<boolean>;
}

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  /** saved 가 없어도 같은 시간이 걸리게 확인함 (가입 여부를 시간으로 알아내지 못하게) */
  abstract verify(password: string, saved?: string | null): Promise<boolean>;
}

export abstract class IdentityMailer {
  abstract readonly ready: boolean;
  abstract sendVerify(to: string, name: string, token: string): Promise<void>;
  abstract sendReset(to: string, name: string, token: string): Promise<void>;
}
