import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminTokenGuard } from '../messages/admin-token.guard.js';
import { CommunityAuthService } from './community-auth.service.js';
import { CommunityController } from './community.controller.js';
import { CommunityMailService } from './community-mail.service.js';
import { CommunityPostsService } from './community-posts.service.js';
import { CommunityProfileService } from './community-profile.service.js';
import { CommunityStorageService } from './community-storage.service.js';
import {
  CommunityComment, CommunityCommentSchema, CommunityPost, CommunityPostSchema,
  CommunityReport, CommunityReportSchema, CommunitySession, CommunitySessionSchema,
  CommunityToken, CommunityTokenSchema, CommunityUser, CommunityUserSchema,
} from './community.schemas.js';

@Module({
  imports: [MongooseModule.forFeature([
    { name: CommunityUser.name, schema: CommunityUserSchema },
    { name: CommunitySession.name, schema: CommunitySessionSchema },
    { name: CommunityToken.name, schema: CommunityTokenSchema },
    { name: CommunityPost.name, schema: CommunityPostSchema },
    { name: CommunityComment.name, schema: CommunityCommentSchema },
    { name: CommunityReport.name, schema: CommunityReportSchema },
  ])],
  controllers: [CommunityController],
  providers: [
    CommunityAuthService, CommunityPostsService, CommunityProfileService,
    CommunityMailService, CommunityStorageService, AdminTokenGuard,
  ],
})
export class CommunityModule {}
