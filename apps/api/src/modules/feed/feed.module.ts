import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityModule } from '../identity/index.js';
import { FeedMediaService } from './application/feed-media.service.js';
import { MembersService } from './application/members.service.js';
import { ModerationService } from './application/moderation.service.js';
import { PostsService } from './application/posts.service.js';
import { VideoPreviews } from './application/video-previews.js';
import {
  CommentRepository, FeedImageRepository, LikeRepository, PostRepository, ReportRepository, VideoCache, VideoSource,
} from './domain/feed.ports.js';
import {
  CommunityComment, CommunityCommentSchema, CommunityImage, CommunityImageSchema, CommunityLike, CommunityLikeSchema,
  CommunityPost, CommunityPostSchema, CommunityReport, CommunityReportSchema, CommunityVideoMeta, CommunityVideoMetaSchema,
} from './infrastructure/persistence/feed.schemas.js';
import {
  MongoCommentRepository, MongoFeedImageRepository, MongoLikeRepository, MongoPostRepository, MongoReportRepository, MongoVideoCache,
} from './infrastructure/persistence/mongo-feed.repositories.js';
import { YoutubeVideoSource } from './infrastructure/youtube-video-source.js';
import { FeedAdminController } from './presentation/feed-admin.controller.js';
import { MembersController } from './presentation/members.controller.js';
import { PostsController } from './presentation/posts.controller.js';

// 피드 영역: 글, 답글 타래, 좋아요, 사진, 유튜브 미리보기, 신고, 회원 페이지
@Module({
  imports: [IdentityModule, MongooseModule.forFeature([
    { name: CommunityPost.name, schema: CommunityPostSchema },
    { name: CommunityComment.name, schema: CommunityCommentSchema },
    { name: CommunityReport.name, schema: CommunityReportSchema },
    { name: CommunityLike.name, schema: CommunityLikeSchema },
    { name: CommunityImage.name, schema: CommunityImageSchema },
    { name: CommunityVideoMeta.name, schema: CommunityVideoMetaSchema },
  ])],
  controllers: [PostsController, MembersController, FeedAdminController],
  providers: [
    PostsService, ModerationService, MembersService, FeedMediaService, VideoPreviews,
    { provide: PostRepository, useClass: MongoPostRepository },
    { provide: CommentRepository, useClass: MongoCommentRepository },
    { provide: ReportRepository, useClass: MongoReportRepository },
    { provide: LikeRepository, useClass: MongoLikeRepository },
    { provide: FeedImageRepository, useClass: MongoFeedImageRepository },
    { provide: VideoCache, useClass: MongoVideoCache },
    { provide: VideoSource, useClass: YoutubeVideoSource },
  ],
  exports: [ModerationService, VideoPreviews],
})
export class FeedModule {}
