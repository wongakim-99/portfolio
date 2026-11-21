import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { REPORT_REASONS, REPORT_TARGETS, type ReportReason, type ReportTarget } from '../../domain/feed.js';

// 피드 컬렉션. 이름은 처음 만들 때의 community_* 를 그대로 씀 (데이터가 이미 있음)

@Schema({ collection: 'community_posts', versionKey: false, timestamps: true })
export class CommunityPost {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
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

  createdAt: Date;
  updatedAt: Date;
}

export const CommunityCommentSchema = SchemaFactory.createForClass(CommunityComment);
CommunityCommentSchema.index({ postId: 1, _id: 1 });
CommunityCommentSchema.index({ authorId: 1 });

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
