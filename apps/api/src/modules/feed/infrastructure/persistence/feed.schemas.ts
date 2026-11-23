import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { LIKE_TARGETS, REPORT_REASONS, REPORT_TARGETS, type LikeTarget, type ReportReason, type ReportTarget } from '../../domain/feed.js';

// 피드 컬렉션. 이름은 처음 만들 때의 community_* 를 그대로 씀 (데이터가 이미 있음)
// 쓰레드식으로 바꾸기 전 문서에는 photos, video, likeCount, parentId 가 없어서 읽을 때 기본값을 채움

// 글과 답글 속 첫 유튜브 영상
@Schema({ _id: false, versionKey: false })
export class CommunityVideo {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, default: null })
  title: string | null;

  @Prop({ type: String, default: null })
  author: string | null;
}
const CommunityVideoSchema = SchemaFactory.createForClass(CommunityVideo);

@Schema({ collection: 'community_posts', versionKey: false, timestamps: true })
export class CommunityPost {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  authorId: Types.ObjectId;

  @Prop({ type: String, required: true })
  authorName: string;

  // 짧은 글은 빈 글자
  @Prop({ type: String, default: '' })
  title: string;

  // 사진만 올린 짧은 글은 빈 글자
  @Prop({ type: String, default: '' })
  body: string;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: CommunityVideoSchema, default: null })
  video: CommunityVideo | null;

  @Prop({ type: Number, default: 0 })
  commentCount: number;

  @Prop({ type: Number, default: 0 })
  likeCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export const CommunityPostSchema = SchemaFactory.createForClass(CommunityPost);
// 회원 페이지의 쓴 글 목록
CommunityPostSchema.index({ authorId: 1, _id: -1 });

@Schema({ collection: 'community_comments', versionKey: false, timestamps: true })
export class CommunityComment {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  postId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  authorId: Types.ObjectId;

  @Prop({ type: String, required: true })
  authorName: string;

  @Prop({ type: String, required: true })
  body: string;

  // 답글에 단 답글이면 그 타래의 첫 답글
  @Prop({ type: SchemaTypes.ObjectId, default: null })
  parentId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  replyToName: string | null;

  @Prop({ type: CommunityVideoSchema, default: null })
  video: CommunityVideo | null;

  @Prop({ type: Number, default: 0 })
  likeCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export const CommunityCommentSchema = SchemaFactory.createForClass(CommunityComment);
CommunityCommentSchema.index({ postId: 1, _id: 1 });
CommunityCommentSchema.index({ authorId: 1 });
CommunityCommentSchema.index({ parentId: 1 }, { partialFilterExpression: { parentId: { $type: 'objectId' } } });

// 좋아요. 한 사람이 같은 글이나 답글에 한 번만 누름. 숫자는 글과 답글의 likeCount 에 같이 셈
@Schema({ collection: 'community_likes', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class CommunityLike {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: LIKE_TARGETS })
  targetType: LikeTarget;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  targetId: Types.ObjectId;

  createdAt: Date;
}

export const CommunityLikeSchema = SchemaFactory.createForClass(CommunityLike);
CommunityLikeSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
CommunityLikeSchema.index({ targetType: 1, targetId: 1 });

// 피드 글에 붙인 사진. 올린 사람만 자기 글에 붙임. 글을 저장하기 전이면 postId 가 null
@Schema({ collection: 'community_images', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class CommunityImage {
  @Prop({ type: String, required: true, unique: true })
  file: string;

  @Prop({ type: Number, required: true })
  size: number;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  postId: Types.ObjectId | null;

  createdAt: Date;
}

export const CommunityImageSchema = SchemaFactory.createForClass(CommunityImage);
CommunityImageSchema.index({ postId: 1, createdAt: 1 });

// 유튜브에서 읽어 둔 영상 제목과 채널. 영상 ID 하나에 한 건
@Schema({ collection: 'community_videos', versionKey: false, timestamps: true })
export class CommunityVideoMeta {
  @Prop({ type: String, required: true, unique: true })
  videoId: string;

  @Prop({ type: String, default: null })
  title: string | null;

  @Prop({ type: String, default: null })
  author: string | null;
}

export const CommunityVideoMetaSchema = SchemaFactory.createForClass(CommunityVideoMeta);

@Schema({ collection: 'community_reports', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class CommunityReport {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  reporterId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: REPORT_TARGETS })
  targetType: ReportTarget;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: REPORT_REASONS })
  reason: ReportReason;

  createdAt: Date;
}

export const CommunityReportSchema = SchemaFactory.createForClass(CommunityReport);
CommunityReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
