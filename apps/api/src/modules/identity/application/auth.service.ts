import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { hashSecretToken, newSecretToken, SECRET_TOKEN } from '../../../shared/crypto/secret-token.js';
import { IdentityMailer, MailTokenRepository, PasswordHasher, SessionRepository, UserRepository } from '../domain/identity.ports.js';
import { MAIL_RESEND_GAP_MS, PENDING_AGE_MS, RESET_AGE_MS, SESSION_AGE_MS, VERIFY_AGE_MS, type MailTokenKind } from '../domain/session.js';
import { toIdentity, type Identity } from '../domain/user.js';

/** 로그인에 성공하면 세션 토큰을 같이 돌려주고, 쿠키에 싣는 일은 presentation 이 함 */
export interface SignedIn {
  identity: Identity;
  sessionToken: string;
}

// 가입, 이메일 확인, 로그인, 로그아웃, 비밀번호 재설정과 변경
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly mailTokens: MailTokenRepository,
    private readonly passwords: PasswordHasher,
    private readonly mail: IdentityMailer,
  ) {}

  get registrationEnabled(): boolean {
    return this.mail.ready;
  }

  private async openSession(userId: string): Promise<string> {
    const token = newSecretToken();
    const now = Date.now();
    await this.sessions.create(hashSecretToken(token), userId, new Date(now + SESSION_AGE_MS));
    // 관리실 회원 목록의 '마지막 로그인'
    await this.users.touchLogin(userId, new Date(now));
    return token;
  }

  private async issueMailToken(userId: string, kind: MailTokenKind, ageMs: number): Promise<string> {
    const token = newSecretToken();
    await this.mailTokens.issue(userId, kind, hashSecretToken(token), new Date(Date.now() + ageMs));
    return token;
  }

  async register(input: { email: string; name: string; password: string }): Promise<void> {
    if (!this.mail.ready) throw new ServiceUnavailableException('가입 메일 설정을 준비 중입니다.');
    await this.users.deleteExpiredPending(input.email, new Date());
    if (await this.users.existsByEmail(input.email)) return;
    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.users.createPending({
      email: input.email, name: input.name, passwordHash, pendingExpiresAt: new Date(Date.now() + PENDING_AGE_MS),
    });
    if (!user) return;
    const token = await this.issueMailToken(user.id, 'verify', VERIFY_AGE_MS);
    try {
      await this.mail.sendVerify(user.email, user.name, token);
    } catch {
      await this.mailTokens.delete(hashSecretToken(token));
      await this.users.deleteUnverified(user.id);
      throw new ServiceUnavailableException('확인 메일을 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.');
    }
  }

  async verify(token: string): Promise<SignedIn> {
    if (!SECRET_TOKEN.test(token)) throw new BadRequestException('확인 링크가 올바르지 않습니다.');
    const userId = await this.mailTokens.consume(hashSecretToken(token), 'verify', new Date());
    if (!userId) throw new BadRequestException('확인 링크가 만료되었거나 이미 사용되었습니다.');
    const user = await this.users.markVerified(userId);
    if (!user) throw new BadRequestException('계정을 찾을 수 없습니다.');
    return { identity: toIdentity(user), sessionToken: await this.openSession(user.id) };
  }

  async resendVerification(input: { email: string; password: string }): Promise<void> {
    if (!this.mail.ready) throw new ServiceUnavailableException('가입 메일 설정을 준비 중입니다.');
    const user = await this.users.findPendingByEmail(input.email, new Date());
    if (!(await this.passwords.verify(input.password, user?.passwordHash))) return;
    if (await this.mailTokens.issuedSince(user!.id, 'verify', new Date(Date.now() - MAIL_RESEND_GAP_MS))) return;
    const token = await this.issueMailToken(user!.id, 'verify', VERIFY_AGE_MS);
    try {
      await this.mail.sendVerify(user!.email, user!.name, token);
    } catch {
      await this.mailTokens.delete(hashSecretToken(token));
      throw new ServiceUnavailableException('확인 메일을 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.');
    }
  }

  async requestReset(email: string): Promise<void> {
    if (!this.mail.ready) throw new ServiceUnavailableException('메일 설정을 준비 중입니다.');
    const user = await this.users.findVerifiedByEmail(email);
    if (!user) return;
    if (await this.mailTokens.issuedSince(user.id, 'reset', new Date(Date.now() - MAIL_RESEND_GAP_MS))) return;
    const token = await this.issueMailToken(user.id, 'reset', RESET_AGE_MS);
    try {
      await this.mail.sendReset(user.email, user.name, token);
    } catch {
      await this.mailTokens.delete(hashSecretToken(token));
      throw new ServiceUnavailableException('메일을 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.');
    }
  }

  // 비밀번호를 바꾸면 모든 로그인이 풀림
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!SECRET_TOKEN.test(token)) throw new BadRequestException('재설정 링크가 올바르지 않습니다.');
    const passwordHash = await this.passwords.hash(newPassword);
    const userId = await this.mailTokens.consume(hashSecretToken(token), 'reset', new Date());
    if (!userId) throw new BadRequestException('재설정 링크가 만료되었거나 이미 사용되었습니다.');
    await this.users.setPasswordHash(userId, passwordHash, true);
    await this.sessions.deleteAllFor(userId);
  }

  async login(input: { email: string; password: string }): Promise<SignedIn> {
    const user = await this.users.findByEmail(input.email);
    if (!(await this.passwords.verify(input.password, user?.passwordHash))) {
      throw new UnauthorizedException('이메일 또는 비밀번호를 확인해 주세요.');
    }
    if (!user!.verifiedAt) throw new ForbiddenException('이메일 확인 후 로그인해 주세요.');
    return { identity: toIdentity(user!), sessionToken: await this.openSession(user!.id) };
  }

  /** 쿠키의 세션 토큰으로 지금 로그인한 사람. 이메일 확인을 마친 회원만 */
  async identityFor(sessionToken: string | null): Promise<Identity | null> {
    if (!sessionToken) return null;
    const userId = await this.sessions.findUserId(hashSecretToken(sessionToken), new Date());
    if (!userId) return null;
    const user = await this.users.findVerifiedById(userId);
    return user ? toIdentity(user) : null;
  }

  async logout(sessionToken: string | null): Promise<void> {
    if (sessionToken) await this.sessions.delete(hashSecretToken(sessionToken));
  }

  // 지금 창의 로그인만 남기고 다른 기기의 로그인은 풂
  async changePassword(identity: Identity, sessionToken: string | null, input: { currentPassword: string; newPassword: string }): Promise<void> {
    const user = await this.users.findById(identity.id);
    if (!user || !(await this.passwords.verify(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('현재 비밀번호를 확인해 주세요.');
    }
    await this.users.setPasswordHash(user.id, await this.passwords.hash(input.newPassword));
    await this.sessions.deleteAllFor(identity.id, sessionToken ? hashSecretToken(sessionToken) : '');
  }
}
