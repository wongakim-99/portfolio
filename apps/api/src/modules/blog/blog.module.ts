import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityModule } from '../identity/index.js';
import { BlogAccessService } from './application/blog-access.service.js';
import { BlogPostsService } from './application/blog-posts.service.js';
import { ProofGradingService } from './application/proof-grading.service.js';
import { ReaderAccess } from './application/reader-access.js';
import {
  AccessRequestRepository, BlogNotifier, BlogPostRepository, GrantRepository, ProofGrader,
} from './domain/blog.ports.js';
import { MailBlogNotifier } from './infrastructure/mail-blog-notifier.js';
import { OpenAiProofGrader } from './infrastructure/openai-proof-grader.js';
import {
  BlogAccessRequest, BlogAccessRequestSchema, BlogGrant, BlogGrantSchema, BlogPost, BlogPostSchema,
} from './infrastructure/persistence/blog.schemas.js';
import {
  MongoAccessRequestRepository, MongoBlogPostRepository, MongoGrantRepository,
} from './infrastructure/persistence/mongo-blog.repositories.js';
import { BlogAdminController } from './presentation/blog-admin.controller.js';
import { BlogController } from './presentation/blog.controller.js';

// 블로그 영역 (gawon-log): 주인장 글, 공개 범위, 열람 요청과 허락, 잠긴 글의 증명 채점
@Module({
  imports: [IdentityModule, MongooseModule.forFeature([
    { name: BlogPost.name, schema: BlogPostSchema },
    { name: BlogAccessRequest.name, schema: BlogAccessRequestSchema },
    { name: BlogGrant.name, schema: BlogGrantSchema },
  ])],
  controllers: [BlogController, BlogAdminController],
  providers: [
    BlogPostsService, BlogAccessService, ReaderAccess, ProofGradingService,
    { provide: BlogPostRepository, useClass: MongoBlogPostRepository },
    { provide: AccessRequestRepository, useClass: MongoAccessRequestRepository },
    { provide: GrantRepository, useClass: MongoGrantRepository },
    { provide: BlogNotifier, useClass: MailBlogNotifier },
    { provide: ProofGrader, useClass: OpenAiProofGrader },
  ],
})
export class BlogModule {}
