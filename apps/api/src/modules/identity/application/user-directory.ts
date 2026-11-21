import { Injectable } from '@nestjs/common';
import { isEntityId } from '../../../shared/domain/entity-id.js';
import { UserRepository } from '../domain/identity.ports.js';
import { toPerson, toPublicProfile, type Person, type PublicProfile } from '../domain/user.js';

// 다른 영역(피드, 블로그)이 회원 정보를 읽는 창구. 계정 컬렉션을 직접 읽지 않고 이것만 씀
@Injectable()
export class UserDirectory {
  constructor(private readonly users: UserRepository) {}

  /** 글쓴이, 요청한 사람의 이름과 지금 프로필 사진 */
  async people(ids: string[]): Promise<Map<string, Person>> {
    const users = await this.users.findVerifiedByIds([...new Set(ids)].filter(isEntityId));
    return new Map(users.map((user) => [user.id, toPerson(user)]));
  }

  async publicProfile(id: string): Promise<PublicProfile | null> {
    if (!isEntityId(id)) return null;
    const user = await this.users.findVerifiedById(id);
    return user ? toPublicProfile(user) : null;
  }

  /** 알림 메일을 보낼 이름과 주소 */
  async contact(id: string): Promise<{ email: string; name: string } | null> {
    const user = isEntityId(id) ? await this.users.findVerifiedById(id) : null;
    return user && { email: user.email, name: user.name };
  }

  /** 사이트 주인(owner 역할). 블로그 사이드바 소개와 열람 요청 알림에 씀 */
  async owners(): Promise<(PublicProfile & { email: string })[]> {
    return (await this.users.findOwners()).map((user) => ({ ...toPublicProfile(user), email: user.email }));
  }
}
