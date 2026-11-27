import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { VISIBILITIES, type AccessRequestStatus, type Visibility } from '../../domain/blog.js';

// 블로그 컬렉션. 회원 ID 는 계정 영역(identity)의 community_users 문서 ID

@Schema({ collection: 'blog_posts', versionKey: false, timestamps: true })
export class BlogPost {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  authorId: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: String, required: true, enum: VISIBILITIES })
  visibility: Visibility;

  // 글쓴이가 붙인 태그. 목록에서 태그로 모아 보고 사이드바에 많이 쓴 순서로 보여 줌
  @Prop({ type: [String], default: [] })
  tags: string[];

  // 글쓴이가 고른 표지 사진 파일(blog_images 의 file). 없으면 본문 첫 사진을 썸네일로 씀
  @Prop({ type: String, default: null })
  cover: string | null;

  // 글이 든 방(blog_rooms). 방이 생기기 전의 글은 이 필드가 없거나 null
  @Prop({ type: SchemaTypes.ObjectId, default: null })
  roomId: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const BlogPostSchema = SchemaFactory.createForClass(BlogPost);
BlogPostSchema.index({ visibility: 1, _id: -1 });
BlogPostSchema.index({ tags: 1, _id: -1 });
BlogPostSchema.index({ roomId: 1, _id: -1 });

// 쓰다 만 글. 글쓰기 화면이 주기적으로 덮어쓰고, 글을 올리면 지움. postId 가 null 이면 아직 올리지 않은 새 글
// 쓰는 중이라 제목, 본문이 비어 있을 수 있음 (required 는 빈 글자를 받지 않아 기본값으로 둠)
@Schema({ collection: 'blog_drafts', versionKey: false, timestamps: true })
export class BlogDraft {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  authorId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  postId: Types.ObjectId | null;

  @Prop({ type: String, default: '' })
  title: string;

  @Prop({ type: String, default: '' })
  body: string;

  @Prop({ type: String, required: true, enum: VISIBILITIES })
  visibility: Visibility;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, default: null })
  cover: string | null;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  roomId: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const BlogDraftSchema = SchemaFactory.createForClass(BlogDraft);
BlogDraftSchema.index({ authorId: 1, postId: 1 }, { unique: true });
BlogDraftSchema.index({ postId: 1 });

// 책상 달력의 쓴 시간. 글쓴이의 서울 날짜 하나에 그날 글을 고친 분(UTC 분)을 겹치지 않게 모음. 쓴 분 수는 minutes 길이
@Schema({ collection: 'blog_writing_days', versionKey: false })
export class BlogWritingDay {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  authorId: Types.ObjectId;

  // 서울 날짜 '2026-11-27'
  @Prop({ type: String, required: true })
  day: string;

  @Prop({ type: [Number], default: [] })
  minutes: number[];
}

export const BlogWritingDaySchema = SchemaFactory.createForClass(BlogWritingDay);
BlogWritingDaySchema.index({ authorId: 1, day: 1 }, { unique: true });
BlogWritingDaySchema.index({ day: 1 });

// 블로그 방. 주인장이 관리실에서 만들고 order 순서로 사이드바에 놓임
@Schema({ collection: 'blog_rooms', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class BlogRoom {
  @Prop({ type: String, required: true, unique: true })
  name: string;

  @Prop({ type: Number, required: true, default: 0 })
  order: number;

  createdAt: Date;
}

export const BlogRoomSchema = SchemaFactory.createForClass(BlogRoom);

// 회원 한 사람이 글 한 편에 남기는 열람 요청. 거절돼도 지우지 않고 남겨서 다시 보낼 수 있는 때를 셈
@Schema({ collection: 'blog_access_requests', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class BlogAccessRequest {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  postId: Types.ObjectId;

  @Prop({ type: String, default: '' })
  message: string;

  @Prop({ type: String, required: true, enum: ['pending', 'rejected'], default: 'pending' })
  status: AccessRequestStatus;

  @Prop({ type: Date, default: null })
  decidedAt: Date | null;

  createdAt: Date;
}

export const BlogAccessRequestSchema = SchemaFactory.createForClass(BlogAccessRequest);
BlogAccessRequestSchema.index({ userId: 1, postId: 1 }, { unique: true });
BlogAccessRequestSchema.index({ status: 1, _id: -1 });

// 열람 허락. postId 가 null 이면 approved 글 전부 (앞으로 쓸 글 포함)
@Schema({ collection: 'blog_grants', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class BlogGrant {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  postId: Types.ObjectId | null;

  createdAt: Date;
}

export const BlogGrantSchema = SchemaFactory.createForClass(BlogGrant);
BlogGrantSchema.index({ userId: 1, postId: 1 }, { unique: true });

// 블로그에 올린 사진. 파일은 사진 저장소 blog/ 아래에 있고, 여기는 어느 글에 붙었는지만 적음
// 증명 채점에서 바깥 AI 를 부른 횟수. _id 는 '2026-11-22'(사이트 전체) 또는 '2026-11-22:<방문자 IP 해시>'
// 한도는 그날만 세므로 이틀 뒤 저절로 지워짐 (expireAt TTL)
@Schema({ collection: 'blog_proof_usage', versionKey: false })
export class BlogProofUsage {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, required: true, default: 0 })
  count: number;

  @Prop({ type: Date, required: true })
  expireAt: Date;
}

export const BlogProofUsageSchema = SchemaFactory.createForClass(BlogProofUsage);
BlogProofUsageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

@Schema({ collection: 'blog_images', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class BlogImage {
  @Prop({ type: String, required: true, unique: true })
  file: string;

  @Prop({ type: Number, required: true })
  size: number;

  // 아직 글을 저장하지 않았으면 null
  @Prop({ type: SchemaTypes.ObjectId, default: null })
  postId: Types.ObjectId | null;

  createdAt: Date;
}

export const BlogImageSchema = SchemaFactory.createForClass(BlogImage);
BlogImageSchema.index({ postId: 1 });
BlogImageSchema.index({ postId: 1, createdAt: 1 });
