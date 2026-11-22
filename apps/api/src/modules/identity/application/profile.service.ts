import {
  BadRequestException, Injectable, NotFoundException, PayloadTooLargeException, ServiceUnavailableException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import { DomainEvents } from '../../../shared/events/domain-events.js';
import { ObjectStorage } from '../../../shared/infrastructure/storage/object-storage.js';
import { AVATAR_FILE, AVATAR_MAX_BYTES, AVATAR_MAX_SIDE, avatarKey, avatarUrl } from '../domain/avatar.js';
import { imageInfo } from '../../../shared/domain/image-info.js';
import { UserRepository } from '../domain/identity.ports.js';
import type { Role } from '../domain/role.js';
import type { Identity } from '../domain/user.js';

// 내 이름, 소개, 프로필 사진과 (ADMIN_TOKEN 으로만 하는) 역할 지정
@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UserRepository,
    private readonly storage: ObjectStorage,
    private readonly events: DomainEvents,
  ) {}

  get uploadsEnabled(): boolean {
    return this.storage.ready;
  }

  // 이름이 바뀌면 다른 영역(피드의 글쓴이 이름)이 따라 바꾸도록 알림
  async update(identity: Identity, profile: { name: string; bio: string }): Promise<void> {
    await this.users.updateProfile(identity.id, profile);
    if (profile.name !== identity.name) await this.events.publish({ type: 'user.renamed', userId: identity.id, name: profile.name });
  }

  // 역할 지정은 서버의 ADMIN_TOKEN 으로만 함. 페이지에서 스스로 관리자가 되는 길은 없음
  async setRole(email: string, role: Role) {
    const user = await this.users.setRoleByEmail(email, role);
    if (!user) throw new NotFoundException('이메일 확인을 마친 회원을 찾을 수 없습니다.');
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  // 파일 내용으로 형식과 크기를 확인함. 확장자나 Content-Type 은 믿지 않음
  async setAvatar(identity: Identity, body: unknown) {
    if (!this.storage.ready) throw new ServiceUnavailableException('사진 저장소를 준비 중입니다.');
    if (Buffer.isBuffer(body) && body.length > AVATAR_MAX_BYTES) throw new PayloadTooLargeException('프로필 사진은 1MB 까지 올릴 수 있습니다.');
    const image = Buffer.isBuffer(body) ? imageInfo(body) : null;
    if (!image) throw new UnsupportedMediaTypeException('JPG, PNG, WebP 사진만 올릴 수 있습니다.');
    if (image.width < 1 || image.height < 1 || image.width > AVATAR_MAX_SIDE || image.height > AVATAR_MAX_SIDE) {
      throw new BadRequestException(`가로와 세로가 ${AVATAR_MAX_SIDE}px 이하인 사진을 올려 주세요.`);
    }
    const file = `${identity.id}-${randomBytes(8).toString('hex')}.${image.ext}`;
    await this.storage.put(avatarKey(file), body as Buffer, image.type);
    await this.discard(await this.users.setAvatar(identity.id, file));
    return { avatarUrl: avatarUrl(file) };
  }

  async removeAvatar(identity: Identity): Promise<void> {
    await this.discard(await this.users.setAvatar(identity.id, null));
  }

  readAvatar(file: string): Promise<Readable> {
    if (!AVATAR_FILE.test(file)) throw new NotFoundException('사진을 찾을 수 없습니다.');
    return this.storage.get(avatarKey(file));
  }

  private async discard(file?: string | null): Promise<void> {
    if (!file) return;
    try {
      await this.storage.remove(avatarKey(file));
    } catch { /* 지우지 못한 옛 사진은 버킷에 남지만 더는 페이지에 쓰이지 않음 */ }
  }
}
