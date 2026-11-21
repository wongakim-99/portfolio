import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityModule } from '../identity/index.js';
import { MembersService } from './application/members.service.js';
import { ModerationService } from './application/moderation.service.js';
import { PostsService } from './application/posts.service.js';
import { CommentRepository, PostRepository, ReportRepository } from './domain/feed.ports.js';
import {
  CommunityComment, CommunityCommentSchema, CommunityPost, CommunityPostSchema, CommunityReport, CommunityReportSchema,
} from './infrastructure/persistence/feed.schemas.js';
import { MongoCommentRepository, MongoPostRepository, MongoReportRepository } from './infrastructure/persistence/mongo-feed.repositories.js';
import { FeedAdminController } from './presentation/feed-admin.controller.js';
import { MembersController } from './presentation/members.controller.js';
import { PostsController } from './presentation/posts.controller.js';

// 피드 영역: 글, 댓글, 신고, 회원 페이지
@Module({
  imports: [IdentityModule, MongooseModule.forFeature([
    { name: CommunityPost.name, schema: CommunityPostSchema },
    { name: CommunityComment.name, schema: CommunityCommentSchema },
    { name: CommunityReport.name, schema: CommunityReportSchema },
  ])],
  controllers: [PostsController, MembersController, FeedAdminController],
  providers: [
    PostsService, ModerationService, MembersService,
    { provide: PostRepository, useClass: MongoPostRepository },
    { provide: CommentRepository, useClass: MongoCommentRepository },
    { provide: ReportRepository, useClass: MongoReportRepository },
  ],
  exports: [ModerationService],
})
export class FeedModule {}
