import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ collection: 'community_users', versionKey: false, timestamps: true })
export class CommunityUser {
  @Prop({ type: String, required: true, unique: true })
  email: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

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

@Schema({ collection: 'community_posts', versionKey: false, timestamps: true })
export class CommunityPost {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityUser.name })
  authorId: Types.ObjectId;

  @Prop({ type: String, required: true })
  authorName: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: Number, default: 0 })
  commentCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export const CommunityPostSchema = SchemaFactory.createForClass(CommunityPost);

@Schema({ collection: 'community_comments', versionKey: false, timestamps: true })
export class CommunityComment {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityPost.name })
  postId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityUser.name })
  authorId: Types.ObjectId;

  @Prop({ type: String, required: true })
  authorName: string;

  @Prop({ type: String, required: true })
  body: string;

  createdAt: Date;
  updatedAt: Date;
}

export const CommunityCommentSchema = SchemaFactory.createForClass(CommunityComment);
CommunityCommentSchema.index({ postId: 1, _id: 1 });

@Schema({ collection: 'community_reports', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class CommunityReport {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityUser.name })
  reporterId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['post', 'comment'] })
  targetType: 'post' | 'comment';

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['spam', 'abuse', 'other'] })
  reason: 'spam' | 'abuse' | 'other';

  createdAt: Date;
}

export const CommunityReportSchema = SchemaFactory.createForClass(CommunityReport);
CommunityReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
