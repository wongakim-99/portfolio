import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { ChangePasswordDto, LoginDto, RegisterDto } from './community.dto.js';
import { CommunityMailService } from './community-mail.service.js';
import { CommunitySession, CommunityToken, CommunityUser } from './community.schemas.js';
import { permissionsOf, type Permission, type Role } from './community-roles.js';
import { avatarUrl } from './community-storage.service.js';

const SCRYPT_OPTIONS = { N: 1 << 14, r: 8, p: 5, maxmem: 64 * 1024 * 1024 };
const SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFY_AGE_MS = 60 * 60 * 1000;
const RESET_AGE_MS = 30 * 60 * 1000;
const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-community' : 'community_dev';
const DUMMY_SALT = '75a01a8965ae6ecda2a65c3829c20abd';

export type CommunityIdentity = {
  id: string; name: string; email: string; avatarUrl: string | null; role: Role; permissions: Permission[];
};

type IdentitySource = { _id: Types.ObjectId; email: string; name: string; avatar?: string | null; role?: Role | null };

// 페이지는 permissions 로 버튼을 보이거나 숨기기만 하고, 실제 허용 여부는 서버가 요청마다 다시 확인함
function identity(user: IdentitySource): CommunityIdentity {
  const role = user.role ?? 'member';
  return {
    id: String(user._id), email: user.email, name: user.name, avatarUrl: avatarUrl(user.avatar),
    role, permissions: permissionsOf(role),
  };
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, SCRYPT_OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt)).toString('hex')}`;
}

async function verifyPassword(password: string, saved?: string): Promise<boolean> {
  const [salt, expectedHex] = saved?.split(':') ?? [DUMMY_SALT, '0'.repeat(128)];
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expectedHex)) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(expectedHex, 'hex')) && Boolean(saved);
}

@Injectable()
export class CommunityAuthService {
  constructor(
    @InjectModel(CommunityUser.name) private readonly users: Model<CommunityUser>,
    @InjectModel(CommunitySession.name) private readonly sessions: Model<CommunitySession>,
    @InjectModel(CommunityToken.name) private readonly tokens: Model<CommunityToken>,
    private readonly mail: CommunityMailService,
  ) {}

  get registrationEnabled(): boolean { return this.mail.ready; }

  assertSameOrigin(req: Request): void {
    const origin = req.get('origin');
    if (origin) {
      // 운영에서는 Caddy 가 원래 Host 를 그대로 넘김. 로컬 개발에서는 Next dev 서버(:3001)가 /api 를 넘기며
      // Host 를 API 주소로 바꾸고 원래 주소는 X-Forwarded-Host 에 남기므로 개발에서만 그것도 봄
      const hosts = [req.get('host'), ...(process.env.NODE_ENV === 'production' ? [] : [req.get('x-forwarded-host')])];
      try {
        if (hosts.includes(new URL(origin).host)) return;
      } catch { /* invalid Origin */ }
      throw new ForbiddenException('이 페이지에서 다시 시도해 주세요.');
    }
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      throw new ForbiddenException('이 페이지에서 다시 시도해 주세요.');
    }
  }

  private cookieToken(req: Request): string | null {
    const item = req.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
    const token = item?.slice(COOKIE_NAME.length + 1);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  }

  private async issue(userId: Types.ObjectId, res: Response): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.sessions.create({ tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + SESSION_AGE_MS) });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_AGE_MS,
    });
  }

  private async createToken(userId: Types.ObjectId, kind: 'verify' | 'reset', ageMs: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.tokens.deleteMany({ userId, kind });
    await this.tokens.create({ userId, kind, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + ageMs) });
    return token;
  }

  async register(dto: RegisterDto): Promise<void> {
    if (!this.mail.ready) throw new ServiceUnavailableException('가입 메일 설정을 준비 중입니다.');
    await this.users.deleteOne({ email: dto.email, verifiedAt: null, pendingExpiresAt: { $lt: new Date() } });
    if (await this.users.exists({ email: dto.email })) return;
    const passwordHash = await hashPassword(dto.password);
    let user;
    try {
      user = await this.users.create({
        email: dto.email, name: dto.name, passwordHash, verifiedAt: null,
        pendingExpiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) return;
      throw error;
    }
    const token = await this.createToken(user._id, 'verify', VERIFY_AGE_MS);
    try {
      await this.mail.sendVerify(user.email, user.name, token);
    } catch {
      await this.tokens.deleteOne({ tokenHash: tokenHash(token) });
      await this.users.deleteOne({ _id: user._id, verifiedAt: null });
      throw new ServiceUnavailableException('확인 메일을 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.');
    }
  }

  async verify(token: string, res: Response): Promise<CommunityIdentity> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new BadRequestException('확인 링크가 올바르지 않습니다.');
    const saved = await this.tokens.findOneAndDelete({ tokenHash: tokenHash(token), kind: 'verify', expiresAt: { $gt: new Date() } });
    if (!saved) throw new BadRequestException('확인 링크가 만료되었거나 이미 사용되었습니다.');
    const user = await this.users.findByIdAndUpdate(saved.userId, {
      $set: { verifiedAt: new Date() }, $unset: { pendingExpiresAt: 1 },
    }, { returnDocument: 'after' });
    if (!user) throw new BadRequestException('계정을 찾을 수 없습니다.');
    await this.issue(user._id, res);
    return identity(user);
  }

  async resendVerification(dto: LoginDto): Promise<void> {
    if (!this.mail.ready) throw new ServiceUnavailableException('가입 메일 설정을 준비 중입니다.');
    const user = await this.users.findOne({ email: dto.email, verifiedAt: null, pendingExpiresAt: { $gt: new Date() } });
    if (!(await verifyPassword(dto.password, user?.passwordHash))) return;
    const recent = await this.tokens.exists({ userId: user!._id, kind: 'verify', createdAt: { $gt: new Date(Date.now() - 10 * 60_000) } });
    if (recent) return;
    const token = await this.createToken(user!._id, 'verify', VERIFY_AGE_MS);
    try {
      await this.mail.sendVerify(user!.email, user!.name, token);
    } catch {
      await this.tokens.deleteOne({ tokenHash: tokenHash(token) });
      throw new ServiceUnavailableException('확인 메일을 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.');
    }
  }

  async requestReset(email: string): Promise<void> {
    if (!this.mail.ready) throw new ServiceUnavailableException('메일 설정을 준비 중입니다.');
    const user = await this.users.findOne({ email, verifiedAt: { $ne: null } });
    if (!user) return;
    const recent = await this.tokens.exists({ userId: user._id, kind: 'reset', createdAt: { $gt: new Date(Date.now() - 10 * 60_000) } });
    if (recent) return;
    const token = await this.createToken(user._id, 'reset', RESET_AGE_MS);
    try {
      await this.mail.sendReset(user.email, user.name, token);
    } catch {
      await this.tokens.deleteOne({ tokenHash: tokenHash(token) });
      throw new ServiceUnavailableException('메일을 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new BadRequestException('재설정 링크가 올바르지 않습니다.');
    const passwordHash = await hashPassword(newPassword);
    const saved = await this.tokens.findOneAndDelete({ tokenHash: tokenHash(token), kind: 'reset', expiresAt: { $gt: new Date() } });
    if (!saved) throw new BadRequestException('재설정 링크가 만료되었거나 이미 사용되었습니다.');
    await this.users.updateOne({ _id: saved.userId, verifiedAt: { $ne: null } }, { passwordHash });
    await this.sessions.deleteMany({ userId: saved.userId });
  }

  async login(dto: LoginDto, res: Response): Promise<CommunityIdentity> {
    const user = await this.users.findOne({ email: dto.email });
    if (!(await verifyPassword(dto.password, user?.passwordHash))) {
      throw new UnauthorizedException('이메일 또는 비밀번호를 확인해 주세요.');
    }
    if (!user!.verifiedAt) throw new ForbiddenException('이메일 확인 후 로그인해 주세요.');
    await this.issue(user!._id, res);
    return identity(user!);
  }

  async current(req: Request): Promise<CommunityIdentity | null> {
    const token = this.cookieToken(req);
    if (!token) return null;
    const session = await this.sessions.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) return null;
    const user = await this.users.findOne({ _id: session.userId, verifiedAt: { $ne: null } }, { name: 1, email: 1, avatar: 1, role: 1 }).lean();
    return user ? identity(user) : null;
  }

  async require(req: Request): Promise<CommunityIdentity> {
    const user = await this.current(req);
    if (!user) throw new UnauthorizedException('글을 쓰려면 로그인해 주세요.');
    return user;
  }

  async logout(req: Request, res: Response): Promise<void> {
    const token = this.cookieToken(req);
    if (token) await this.sessions.deleteOne({ tokenHash: tokenHash(token) });
    res.clearCookie(COOKIE_NAME, { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  }

  async changePassword(req: Request, dto: ChangePasswordDto): Promise<void> {
    const identity = await this.require(req);
    const user = await this.users.findById(identity.id);
    if (!user || !(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('현재 비밀번호를 확인해 주세요.');
    }
    user.passwordHash = await hashPassword(dto.newPassword);
    await user.save();
    const token = this.cookieToken(req);
    await this.sessions.deleteMany({ userId: new Types.ObjectId(identity.id), tokenHash: { $ne: token ? tokenHash(token) : '' } });
  }
}
