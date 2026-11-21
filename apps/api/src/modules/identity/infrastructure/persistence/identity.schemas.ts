import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { ROLES, type Role } from '../../domain/role.js';

// 계정 컬렉션. 컬렉션 이름은 피드를 처음 만들 때 붙인 community_* 를 그대로 씀 (데이터가 이미 있음)

@Schema({ collection: 'community_users', versionKey: false, timestamps: true })
export class CommunityUser {
  @Prop({ type: String, required: true, unique: true })
  email: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  // 역할만 적고 권한은 domain/role.ts 에서 역할로 계산함
  @Prop({ type: String, enum: ROLES, default: 'member' })
  role: Role;

  @Prop({ type: String, default: '' })
  bio: string;

  // 사진 저장소의 avatars/ 아래 파일 이름. 사진을 바꿀 때마다 새 이름을 써서 브라우저가 오래 캐시해도 됨
  @Prop({ type: String, default: null })
  avatar: string | null;

  @Prop({ type: Date, default: null })
  verifiedAt: Date | null;

  @Prop({ type: Date, default: null })
  pendingExpiresAt: Date | null;

  createdAt: Date;
}

export const CommunityUserSchema = SchemaFactory.createForClass(CommunityUser);
CommunityUserSchema.index({ pendingExpiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({ collection: 'community_sessions', versionKey: false })
export class CommunitySession {
  @Prop({ type: String, required: true, unique: true })
  tokenHash: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityUser.name })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export const CommunitySessionSchema = SchemaFactory.createForClass(CommunitySession);
CommunitySessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({ collection: 'community_tokens', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class CommunityToken {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityUser.name })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['verify', 'reset'] })
  kind: 'verify' | 'reset';

  @Prop({ type: String, required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  createdAt: Date;
}

export const CommunityTokenSchema = SchemaFactory.createForClass(CommunityToken);
CommunityTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
CommunityTokenSchema.index({ userId: 1, kind: 1, createdAt: -1 });
