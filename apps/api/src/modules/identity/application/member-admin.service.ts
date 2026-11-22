import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import { avatarUrl } from '../domain/avatar.js';
import { SessionRepository, UserRepository } from '../domain/identity.ports.js';
import type { Role } from '../domain/role.js';
import { SESSION_AGE_MS } from '../domain/session.js';
import type { Identity, MemberRecord, User } from '../domain/user.js';

const MEMBER_MISSING = '가입 확인을 마친 회원을 찾을 수 없습니다.';
// 관리실 목록은 한 번에 다 받아 화면에서 찾고 거름. 회원이 이보다 많아지면 최근 가입 순으로 자름
const ROSTER_LIMIT = 1000;

// 관리실 회원 칸: 가입한 사람 목록과 주인장의 관리자 지정, 해제
@Injectable()
export class MemberAdminService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async roster(): Promise<{ members: MemberRecord[]; limited: boolean }> {
    const users = await this.users.listAll(ROSTER_LIMIT + 1);
    const page = users.slice(0, ROSTER_LIMIT);
    const now = new Date();
    const activity = await this.sessions.activity(page.map((user) => user.id), now);
    return { members: page.map((user) => toMemberRecord(user, activity.get(user.id))), limited: users.length > ROSTER_LIMIT };
  }

  // 주인장만 부름 (members:role). 주인장 자신과 다른 주인장은 바꾸지 않음. 주인장 지정은 지금처럼 서버의 ADMIN_TOKEN 으로만
  async setRole(actor: Identity, targetId: string, role: Exclude<Role, 'owner'>): Promise<MemberRecord> {
    requireEntityId(targetId, MEMBER_MISSING);
    if (targetId === actor.id) throw new BadRequestException('내 역할은 여기서 바꿀 수 없습니다.');
    const target = await this.users.findVerifiedById(targetId);
    if (!target) throw new NotFoundException(MEMBER_MISSING);
    if (target.role === 'owner') throw new BadRequestException('주인장의 역할은 여기서 바꿀 수 없습니다.');
    const user = await this.users.setRoleById(targetId, role);
    if (!user) throw new NotFoundException(MEMBER_MISSING);
    return toMemberRecord(user, (await this.sessions.activity([user.id], new Date())).get(user.id));
  }
}

function toMemberRecord(user: User, open?: { count: number; latestExpiresAt: Date }): MemberRecord {
  // 로그인 기록을 적기 전에 로그인한 회원은 아직 열린 세션 중 가장 늦은 것의 시작 시각으로 어림함
  const guessed = open ? new Date(open.latestExpiresAt.getTime() - SESSION_AGE_MS) : null;
  return {
    id: user.id, name: user.name, email: user.email, bio: user.bio, avatarUrl: avatarUrl(user.avatar), role: user.role,
    createdAt: user.createdAt, verifiedAt: user.verifiedAt, lastLoginAt: user.lastLoginAt ?? guessed, activeSessions: open?.count ?? 0,
  };
}
