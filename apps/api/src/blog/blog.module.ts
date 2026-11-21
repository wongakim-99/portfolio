import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommunityModule } from '../community/community.module.js';
import { BlogController } from './blog.controller.js';
import { BlogService } from './blog.service.js';
import {
  BlogAccessRequest, BlogAccessRequestSchema, BlogGrant, BlogGrantSchema, BlogPost, BlogPostSchema,
} from './blog.schemas.js';

@Module({
  imports: [CommunityModule, MongooseModule.forFeature([
    { name: BlogPost.name, schema: BlogPostSchema },
    { name: BlogAccessRequest.name, schema: BlogAccessRequestSchema },
    { name: BlogGrant.name, schema: BlogGrantSchema },
  ])],
  controllers: [BlogController],
  providers: [BlogService],
})
export class BlogModule {}
