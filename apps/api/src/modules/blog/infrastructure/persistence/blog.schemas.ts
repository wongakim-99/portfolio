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

  createdAt: Date;
  updatedAt: Date;
}

export const BlogPostSchema = SchemaFactory.createForClass(BlogPost);
BlogPostSchema.index({ visibility: 1, _id: -1 });
BlogPostSchema.index({ tags: 1, _id: -1 });

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
