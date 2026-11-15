import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { ReportDto, WriteCommentDto, WritePostDto } from './community.dto.js';
import { CommunityComment, CommunityPost, CommunityReport } from './community.schemas.js';
import type { CommunityIdentity } from './community-auth.service.js';

function objectId(value: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new NotFoundException('글을 찾을 수 없습니다.');
  return new Types.ObjectId(value);
}

@Injectable()
export class CommunityPostsService {
  constructor(
    @InjectModel(CommunityPost.name) private readonly posts: Model<CommunityPost>,
    @InjectModel(CommunityComment.name) private readonly comments: Model<CommunityComment>,
    @InjectModel(CommunityReport.name) private readonly reports: Model<CommunityReport>,
  ) {}

  async list(before?: string) {
    const filter = before ? { _id: { $lt: objectId(before) } } : {};
    const results = await this.posts.find(filter, { title: 1, body: 1, authorId: 1, authorName: 1, commentCount: 1, createdAt: 1, updatedAt: 1 })
      .sort({ _id: -1 }).limit(11).lean();
    const page = results.slice(0, 10);
    return {
      posts: page.map((post) => ({
        id: String(post._id), title: post.title, excerpt: post.body.slice(0, 220),
        authorId: String(post.authorId), authorName: post.authorName,
        commentCount: post.commentCount, createdAt: post.createdAt, updatedAt: post.updatedAt,
      })),
      nextCursor: results.length > 10 ? String(page.at(-1)!._id) : null,
    };
  }

  async get(id: string) {
    const post = await this.posts.findById(objectId(id)).lean();
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    return {
      id: String(post._id), title: post.title, body: post.body,
      authorId: String(post.authorId), authorName: post.authorName,
      commentCount: post.commentCount, createdAt: post.createdAt, updatedAt: post.updatedAt,
    };
  }

  async create(dto: WritePostDto, author: CommunityIdentity) {
    const post = await this.posts.create({
      title: dto.title, body: dto.body,
      authorId: objectId(author.id), authorName: author.name,
    });
    return this.get(String(post._id));
  }

  async edit(id: string, dto: WritePostDto, author: CommunityIdentity) {
    const post = await this.posts.findById(objectId(id));
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    if (String(post.authorId) !== author.id) throw new ForbiddenException('내 글만 수정할 수 있습니다.');
    post.title = dto.title;
    post.body = dto.body;
    await post.save();
    return this.get(id);
  }

  async remove(id: string, authorId?: string): Promise<void> {
    const post = await this.posts.findById(objectId(id));
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    if (authorId && String(post.authorId) !== authorId) throw new ForbiddenException('내 글만 삭제할 수 있습니다.');
    const commentIds = await this.comments.find({ postId: post._id }, { _id: 1 }).lean();
    await this.posts.deleteOne({ _id: post._id });
    await this.comments.deleteMany({ postId: post._id });
    await this.reports.deleteMany({ $or: [
      { targetType: 'post', targetId: post._id },
      { targetType: 'comment', targetId: { $in: commentIds.map((comment) => comment._id) } },
    ] });
  }

  async listComments(postId: string, after?: string) {
    const post = await this.posts.exists({ _id: objectId(postId) });
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    const filter = after
      ? { postId: objectId(postId), _id: { $gt: objectId(after) } }
      : { postId: objectId(postId) };
    const results = await this.comments.find(filter).sort({ _id: 1 }).limit(41).lean();
    const page = results.slice(0, 40);
    return {
      comments: page.map((comment) => ({
        id: String(comment._id), postId: String(comment.postId), body: comment.body,
        authorId: String(comment.authorId), authorName: comment.authorName,
        createdAt: comment.createdAt, updatedAt: comment.updatedAt,
      })),
      nextCursor: results.length > 40 ? String(page.at(-1)!._id) : null,
    };
  }

  async addComment(postId: string, dto: WriteCommentDto, author: CommunityIdentity) {
    const id = objectId(postId);
    const post = await this.posts.findById(id);
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    const comment = await this.comments.create({ postId: id, authorId: objectId(author.id), authorName: author.name, body: dto.body });
    await this.posts.updateOne({ _id: id }, { $inc: { commentCount: 1 } });
    return { id: String(comment._id), body: comment.body, authorId: author.id, authorName: author.name, createdAt: comment.createdAt };
  }

  async editComment(id: string, dto: WriteCommentDto, author: CommunityIdentity) {
    const comment = await this.comments.findById(objectId(id));
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    if (String(comment.authorId) !== author.id) throw new ForbiddenException('내 댓글만 수정할 수 있습니다.');
    comment.body = dto.body;
    await comment.save();
    return { id, body: comment.body, updatedAt: comment.updatedAt };
  }

  async removeComment(id: string, authorId?: string): Promise<void> {
    const comment = await this.comments.findById(objectId(id));
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    if (authorId && String(comment.authorId) !== authorId) throw new ForbiddenException('내 댓글만 삭제할 수 있습니다.');
    await this.comments.deleteOne({ _id: comment._id });
    await this.posts.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });
    await this.reports.deleteMany({ targetType: 'comment', targetId: comment._id });
  }

  async report(dto: ReportDto, reporter: CommunityIdentity): Promise<void> {
    const targetId = objectId(dto.targetId);
    const exists = dto.targetType === 'post'
      ? await this.posts.exists({ _id: targetId })
      : await this.comments.exists({ _id: targetId });
    if (!exists) throw new NotFoundException('신고할 내용을 찾을 수 없습니다.');
    try {
      await this.reports.create({ reporterId: objectId(reporter.id), targetType: dto.targetType, targetId, reason: dto.reason });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictException('이미 신고한 내용입니다.');
      }
      throw error;
    }
  }

  async reportsForAdmin() {
    const reports = await this.reports.find().sort({ _id: -1 }).limit(100).lean();
    return reports.map((report) => ({
      id: String(report._id), targetType: report.targetType, targetId: String(report.targetId),
      reason: report.reason, createdAt: report.createdAt,
    }));
  }
}
