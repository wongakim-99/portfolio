import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityModule } from '../identity/index.js';
import { BlogAccessService } from './application/blog-access.service.js';
import { BlogImagesService } from './application/blog-images.service.js';
import { BlogPostsService } from './application/blog-posts.service.js';
import { ProofGradingService } from './application/proof-grading.service.js';
import { ReaderAccess } from './application/reader-access.js';
import {
  AccessRequestRepository, BlogImageRepository, BlogNotifier, BlogPostRepository, GrantRepository, ProofGrader, ProofUsageRepository,
} from './domain/blog.ports.js';
import { MailBlogNotifier } from './infrastructure/mail-blog-notifier.js';
import { OpenAiProofGrader } from './infrastructure/openai-proof-grader.js';
import {
  BlogAccessRequest, BlogAccessRequestSchema, BlogGrant, BlogGrantSchema, BlogImage, BlogImageSchema, BlogPost, BlogPostSchema,
  BlogProofUsage, BlogProofUsageSchema,
} from './infrastructure/persistence/blog.schemas.js';
import {
  MongoAccessRequestRepository, MongoBlogImageRepository, MongoBlogPostRepository, MongoGrantRepository, MongoProofUsageRepository,
} from './infrastructure/persistence/mongo-blog.repositories.js';
import { BlogAdminController } from './presentation/blog-admin.controller.js';
import { BlogController } from './presentation/blog.controller.js';

// 블로그 영역 (gawon-log): 주인장 글과 사진, 공개 범위, 열람 요청과 허락, 잠긴 글의 증명 채점
@Module({
  imports: [IdentityModule, MongooseModule.forFeature([
    { name: BlogPost.name, schema: BlogPostSchema },
    { name: BlogAccessRequest.name, schema: BlogAccessRequestSchema },
    { name: BlogGrant.name, schema: BlogGrantSchema },
    { name: BlogImage.name, schema: BlogImageSchema },
    { name: BlogProofUsage.name, schema: BlogProofUsageSchema },
  ])],
  controllers: [BlogController, BlogAdminController],
  providers: [
    BlogPostsService, BlogAccessService, BlogImagesService, ReaderAccess, ProofGradingService,
    { provide: BlogPostRepository, useClass: MongoBlogPostRepository },
    { provide: AccessRequestRepository, useClass: MongoAccessRequestRepository },
    { provide: GrantRepository, useClass: MongoGrantRepository },
    { provide: BlogImageRepository, useClass: MongoBlogImageRepository },
    { provide: BlogNotifier, useClass: MailBlogNotifier },
    { provide: ProofGrader, useClass: OpenAiProofGrader },
    { provide: ProofUsageRepository, useClass: MongoProofUsageRepository },
  ],
})
export class BlogModule {}
