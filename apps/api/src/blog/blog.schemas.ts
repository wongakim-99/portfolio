import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { CommunityUser } from '../community/community.schemas.js';

// 글마다 고르는 공개 범위. public 은 누구나, approved 는 주인이 허락한 회원만, private 은 주인만 읽음
export const VISIBILITIES = ['public', 'approved', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

@Schema({ collection: 'blog_posts', versionKey: false, timestamps: true })
export class BlogPost {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityUser.name })
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

  createdAt: Date;
  updatedAt: Date;
}

export const BlogPostSchema = SchemaFactory.createForClass(BlogPost);
BlogPostSchema.index({ visibility: 1, _id: -1 });
BlogPostSchema.index({ tags: 1, _id: -1 });

// 회원 한 사람이 글 한 편에 남기는 열람 요청. 거절돼도 지우지 않고 남겨서 다시 보낼 수 있는 때를 셈
@Schema({ collection: 'blog_access_requests', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class BlogAccessRequest {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityUser.name })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: BlogPost.name })
  postId: Types.ObjectId;

  @Prop({ type: String, default: '' })
  message: string;

  @Prop({ type: String, required: true, enum: ['pending', 'rejected'], default: 'pending' })
  status: 'pending' | 'rejected';

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
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: CommunityUser.name })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, default: null, ref: BlogPost.name })
  postId: Types.ObjectId | null;

  createdAt: Date;
}

export const BlogGrantSchema = SchemaFactory.createForClass(BlogGrant);
BlogGrantSchema.index({ userId: 1, postId: 1 }, { unique: true });
