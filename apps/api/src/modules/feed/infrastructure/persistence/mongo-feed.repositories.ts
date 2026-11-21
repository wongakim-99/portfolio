import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { asObjectId, isDuplicateKey, toObjectId } from '../../../../shared/infrastructure/mongo.js';
import type { FeedComment, FeedPost, Report, ReportReason, ReportTarget } from '../../domain/feed.js';
import { CommentRepository, PostRepository, ReportRepository } from '../../domain/feed.ports.js';
import { CommunityComment, CommunityPost, CommunityReport } from './feed.schemas.js';

type Doc<T> = T & { _id: unknown };

const toPost = (doc: Doc<CommunityPost>): FeedPost => ({
  id: String(doc._id), authorId: String(doc.authorId), authorName: doc.authorName, title: doc.title, body: doc.body,
  commentCount: doc.commentCount ?? 0, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
});
const toComment = (doc: Doc<CommunityComment>): FeedComment => ({
  id: String(doc._id), postId: String(doc.postId), authorId: String(doc.authorId), authorName: doc.authorName, body: doc.body,
  createdAt: doc.createdAt, updatedAt: doc.updatedAt,
});
const toReport = (doc: Doc<CommunityReport>): Report => ({
  id: String(doc._id), reporterId: String(doc.reporterId), targetType: doc.targetType, targetId: String(doc.targetId),
  reason: doc.reason, createdAt: doc.createdAt,
});

@Injectable()
export class MongoPostRepository extends PostRepository {
  constructor(@InjectModel(CommunityPost.name) private readonly posts: Model<CommunityPost>) {
    super();
  }

  async list({ before, authorId }: { before?: string; authorId?: string }, limit: number) {
    const filter = {
      ...(before ? { _id: { $lt: toObjectId(before) } } : {}),
      ...(authorId ? { authorId: toObjectId(authorId) } : {}),
    };
    const posts = await this.posts.find(filter).sort({ _id: -1 }).limit(limit).lean();
    return posts.map(toPost);
  }

  async findById(id: string) {
    const post = await this.posts.findById(toObjectId(id)).lean();
    return post && toPost(post);
  }

  async findMany(ids: string[]) {
    return (await this.posts.find({ _id: { $in: ids.map(toObjectId) } }).lean()).map(toPost);
  }

  async exists(id: string) {
    return Boolean(await this.posts.exists({ _id: toObjectId(id) }));
  }

  async create(input: { authorId: string; authorName: string; title: string; body: string }) {
    const post = await this.posts.create({ ...input, authorId: asObjectId(input.authorId) });
    return toPost(post.toObject());
  }

  async update(id: string, input: { title: string; body: string }) {
    await this.posts.updateOne({ _id: toObjectId(id) }, { $set: input });
  }

  async delete(id: string) {
    await this.posts.deleteOne({ _id: toObjectId(id) });
  }

  async addToCommentCount(id: string, delta: number) {
    await this.posts.updateOne({ _id: toObjectId(id) }, { $inc: { commentCount: delta } });
  }

  countByAuthor(authorId: string) {
    return this.posts.countDocuments({ authorId: toObjectId(authorId) });
  }

  async renameAuthor(authorId: string, name: string) {
    await this.posts.updateMany({ authorId: toObjectId(authorId) }, { $set: { authorName: name } }, { timestamps: false });
  }
}

@Injectable()
export class MongoCommentRepository extends CommentRepository {
  constructor(@InjectModel(CommunityComment.name) private readonly comments: Model<CommunityComment>) {
    super();
  }

  async listForPost(postId: string, after: string | undefined, limit: number) {
    const filter = { postId: toObjectId(postId), ...(after ? { _id: { $gt: toObjectId(after) } } : {}) };
    return (await this.comments.find(filter).sort({ _id: 1 }).limit(limit).lean()).map(toComment);
  }

  async findById(id: string) {
    const comment = await this.comments.findById(toObjectId(id)).lean();
    return comment && toComment(comment);
  }

  async findMany(ids: string[]) {
    return (await this.comments.find({ _id: { $in: ids.map(toObjectId) } }).lean()).map(toComment);
  }

  async exists(id: string) {
    return Boolean(await this.comments.exists({ _id: toObjectId(id) }));
  }

  async create(input: { postId: string; authorId: string; authorName: string; body: string }) {
    const comment = await this.comments.create({ ...input, postId: asObjectId(input.postId), authorId: asObjectId(input.authorId) });
    return toComment(comment.toObject());
  }

  async updateBody(id: string, body: string) {
    const comment = await this.comments.findByIdAndUpdate(toObjectId(id), { $set: { body } }, { returnDocument: 'after' }).lean();
    return toComment(comment!);
  }

  async delete(id: string) {
    await this.comments.deleteOne({ _id: toObjectId(id) });
  }

  async idsForPost(postId: string) {
    return (await this.comments.find({ postId: toObjectId(postId) }, { _id: 1 }).lean()).map((comment) => String(comment._id));
  }

  async deleteForPost(postId: string) {
    await this.comments.deleteMany({ postId: toObjectId(postId) });
  }

  countByAuthor(authorId: string) {
    return this.comments.countDocuments({ authorId: toObjectId(authorId) });
  }

  async renameAuthor(authorId: string, name: string) {
    await this.comments.updateMany({ authorId: toObjectId(authorId) }, { $set: { authorName: name } }, { timestamps: false });
  }
}

@Injectable()
export class MongoReportRepository extends ReportRepository {
  constructor(@InjectModel(CommunityReport.name) private readonly reports: Model<CommunityReport>) {
    super();
  }

  async create(input: { reporterId: string; targetType: ReportTarget; targetId: string; reason: ReportReason }) {
    try {
      await this.reports.create({ ...input, reporterId: asObjectId(input.reporterId), targetId: asObjectId(input.targetId) });
      return true;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async latest(limit: number) {
    return (await this.reports.find().sort({ _id: -1 }).limit(limit).lean()).map(toReport);
  }

  count() {
    return this.reports.countDocuments();
  }

  async delete(id: string) {
    return (await this.reports.deleteOne({ _id: toObjectId(id) })).deletedCount > 0;
  }

  async deleteFor(targetType: ReportTarget, targetIds: string[]) {
    if (targetIds.length) await this.reports.deleteMany({ targetType, targetId: { $in: targetIds.map(toObjectId) } });
  }
}
