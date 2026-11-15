import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { ProfileDto } from './community.dto.js';
import { CommunityComment, CommunityPost, CommunityUser } from './community.schemas.js';
import type { CommunityIdentity } from './community-auth.service.js';
import { avatarUrl, CommunityStorageService } from './community-storage.service.js';
import { imageInfo } from './image-info.js';

const AVATAR_MAX_SIDE = 2048;

function userId(value: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new NotFoundException('사용자를 찾을 수 없습니다.');
  return new Types.ObjectId(value);
}

@Injectable()
export class CommunityProfileService {
  constructor(
    @InjectModel(CommunityUser.name) private readonly users: Model<CommunityUser>,
    @InjectModel(CommunityPost.name) private readonly posts: Model<CommunityPost>,
    @InjectModel(CommunityComment.name) private readonly comments: Model<CommunityComment>,
    private readonly storage: CommunityStorageService,
  ) {}

  async profile(id: string) {
    const user = await this.users.findOne({ _id: userId(id), verifiedAt: { $ne: null } }, { name: 1, bio: 1, avatar: 1, createdAt: 1 }).lean();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    const [postCount, commentCount] = await Promise.all([
      this.posts.countDocuments({ authorId: user._id }),
      this.comments.countDocuments({ authorId: user._id }),
    ]);
    return {
      id: String(user._id), name: user.name, bio: user.bio ?? '', avatarUrl: avatarUrl(user.avatar),
      createdAt: user.createdAt, postCount, commentCount,
    };
  }

  async update(identity: CommunityIdentity, dto: ProfileDto) {
    const id = userId(identity.id);
    await this.users.updateOne({ _id: id }, { $set: { name: dto.name, bio: dto.bio } });
    if (dto.name !== identity.name) {
      // 글과 댓글에 적어 둔 이름도 바꿈. 이름만 바뀐 것이라 글의 수정 시각은 그대로 둠
      await Promise.all([
        this.posts.updateMany({ authorId: id }, { $set: { authorName: dto.name } }, { timestamps: false }),
        this.comments.updateMany({ authorId: id }, { $set: { authorName: dto.name } }, { timestamps: false }),
      ]);
    }
    return this.profile(identity.id);
  }

  async setAvatar(identity: CommunityIdentity, body: unknown) {
    if (!this.storage.ready) throw new ServiceUnavailableException('사진 저장소를 준비 중입니다.');
    const image = Buffer.isBuffer(body) ? imageInfo(body) : null;
    if (!image) throw new UnsupportedMediaTypeException('JPG, PNG, WebP 사진만 올릴 수 있습니다.');
    if (image.width < 1 || image.height < 1 || image.width > AVATAR_MAX_SIDE || image.height > AVATAR_MAX_SIDE) {
      throw new BadRequestException(`가로와 세로가 ${AVATAR_MAX_SIDE}px 이하인 사진을 올려 주세요.`);
    }
    const file = `${identity.id}-${randomBytes(8).toString('hex')}.${image.ext}`;
    await this.storage.put(`avatars/${file}`, body as Buffer, image.type);
    const before = await this.users.findOneAndUpdate(
      { _id: userId(identity.id) }, { $set: { avatar: file } }, { projection: { avatar: 1 }, returnDocument: 'before' },
    ).lean();
    await this.discard(before?.avatar);
    return { avatarUrl: avatarUrl(file) };
  }

  async removeAvatar(identity: CommunityIdentity): Promise<void> {
    const before = await this.users.findOneAndUpdate(
      { _id: userId(identity.id) }, { $set: { avatar: null } }, { projection: { avatar: 1 }, returnDocument: 'before' },
    ).lean();
    await this.discard(before?.avatar);
  }

  private async discard(file?: string | null): Promise<void> {
    if (!file) return;
    try {
      await this.storage.remove(`avatars/${file}`);
    } catch { /* 지우지 못한 옛 사진은 버킷에 남지만 더는 페이지에 쓰이지 않음 */ }
  }
}
