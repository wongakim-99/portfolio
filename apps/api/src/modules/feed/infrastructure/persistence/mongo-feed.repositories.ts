import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { asObjectId, isDuplicateKey, toObjectId } from '../../../../shared/infrastructure/mongo.js';
import type { FeedComment, FeedPost, FeedVideo, LikeTarget, Report, ReportReason, ReportTarget } from '../../domain/feed.js';
import { CommentRepository, FeedImageRepository, LikeRepository, PostRepository, ReportRepository, VideoCache } from '../../domain/feed.ports.js';
import { CommunityComment, CommunityImage, CommunityLike, CommunityPost, CommunityReport, CommunityVideoMeta, type CommunityVideo } from './feed.schemas.js';

type Doc<T> = T & { _id: unknown };

// 쓰레드식으로 바꾸기 전 문서는 새 필드가 없으므로 기본값을 채움
const toVideo = (video: CommunityVideo | null | undefined): FeedVideo | null =>
  video ? { id: video.id, title: video.title ?? null, author: video.author ?? null } : null;
const toPost = (doc: Doc<CommunityPost>): FeedPost => ({
  id: String(doc._id), authorId: String(doc.authorId), authorName: doc.authorName, title: doc.title ?? '', body: doc.body ?? '',
  photos: doc.photos ?? [], link: doc.link ?? null, video: toVideo(doc.video), commentCount: doc.commentCount ?? 0, likeCount: doc.likeCount ?? 0,
  createdAt: doc.createdAt, updatedAt: doc.updatedAt,
});
const toComment = (doc: Doc<CommunityComment>): FeedComment => ({
  id: String(doc._id), postId: String(doc.postId), authorId: String(doc.authorId), authorName: doc.authorName, body: doc.body,
  parentId: doc.parentId ? String(doc.parentId) : null, replyToName: doc.replyToName ?? null, video: toVideo(doc.video),
  likeCount: doc.likeCount ?? 0, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
});
type PostContent = { title: string; body: string; photos: string[]; link: string | null; video: FeedVideo | null };
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

  async create(input: PostContent & { authorId: string; authorName: string }) {
    const post = await this.posts.create({ ...input, authorId: asObjectId(input.authorId) });
    return toPost(post.toObject());
  }

  async update(id: string, input: PostContent) {
    await this.posts.updateOne({ _id: toObjectId(id) }, { $set: input });
  }

  async delete(id: string) {
    await this.posts.deleteOne({ _id: toObjectId(id) });
  }

  // 답글 수와 좋아요 수는 글의 수정 시각을 바꾸지 않음
  async addToCommentCount(id: string, delta: number) {
    await this.posts.updateOne({ _id: toObjectId(id) }, { $inc: { commentCount: delta } }, { timestamps: false });
  }

  async addToLikeCount(id: string, delta: number) {
    await this.posts.updateOne({ _id: toObjectId(id) }, { $inc: { likeCount: delta } }, { timestamps: false });
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

  async create(input: {
    postId: string; authorId: string; authorName: string; body: string; parentId: string | null; replyToName: string | null; video: FeedVideo | null;
  }) {
    const comment = await this.comments.create({
      ...input, postId: asObjectId(input.postId), authorId: asObjectId(input.authorId), parentId: input.parentId ? asObjectId(input.parentId) : null,
    });
    return toComment(comment.toObject());
  }

  async updateBody(id: string, body: string, video: FeedVideo | null) {
    const comment = await this.comments.findByIdAndUpdate(toObjectId(id), { $set: { body, video } }, { returnDocument: 'after' }).lean();
    return toComment(comment!);
  }

  async delete(id: string) {
    await this.comments.deleteOne({ _id: toObjectId(id) });
  }

  async idsForPost(postId: string) {
    return (await this.comments.find({ postId: toObjectId(postId) }, { _id: 1 }).lean()).map((comment) => String(comment._id));
  }

  async idsForParent(parentId: string) {
    return (await this.comments.find({ parentId: toObjectId(parentId) }, { _id: 1 }).lean()).map((comment) => String(comment._id));
  }

  async deleteMany(ids: string[]) {
    if (ids.length) await this.comments.deleteMany({ _id: { $in: ids.map(toObjectId) } });
  }

  async deleteForPost(postId: string) {
    await this.comments.deleteMany({ postId: toObjectId(postId) });
  }

  async addToLikeCount(id: string, delta: number) {
    await this.comments.updateOne({ _id: toObjectId(id) }, { $inc: { likeCount: delta } }, { timestamps: false });
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

@Injectable()
export class MongoLikeRepository extends LikeRepository {
  constructor(@InjectModel(CommunityLike.name) private readonly likes: Model<CommunityLike>) {
    super();
  }

  async add(userId: string, targetType: LikeTarget, targetId: string) {
    try {
      await this.likes.create({ userId: asObjectId(userId), targetType, targetId: asObjectId(targetId) });
      return true;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async remove(userId: string, targetType: LikeTarget, targetId: string) {
    return (await this.likes.deleteOne({ userId: toObjectId(userId), targetType, targetId: toObjectId(targetId) })).deletedCount > 0;
  }

  async likedBy(userId: string, targetType: LikeTarget, ids: string[]) {
    if (!ids.length) return new Set<string>();
    const liked = await this.likes.find({ userId: toObjectId(userId), targetType, targetId: { $in: ids.map(toObjectId) } }, { targetId: 1 }).lean();
    return new Set(liked.map((like) => String(like.targetId)));
  }

  async deleteFor(targetType: LikeTarget, ids: string[]) {
    if (ids.length) await this.likes.deleteMany({ targetType, targetId: { $in: ids.map(toObjectId) } });
  }
}

@Injectable()
export class MongoFeedImageRepository extends FeedImageRepository {
  constructor(@InjectModel(CommunityImage.name) private readonly images: Model<CommunityImage>) {
    super();
  }

  async create(input: { file: string; size: number; ownerId: string }) {
    await this.images.create({ ...input, ownerId: asObjectId(input.ownerId), postId: null });
  }

  async attach(files: string[], postId: string, ownerId: string) {
    if (!files.length) return [];
    const post = asObjectId(postId);
    const mine = { file: { $in: files }, ownerId: asObjectId(ownerId), $or: [{ postId: null }, { postId: post }] };
    await this.images.updateMany(mine, { $set: { postId: post } });
    const attached = new Set((await this.images.find({ file: { $in: files }, postId: post }, { file: 1 }).lean()).map((image) => image.file));
    return files.filter((file) => attached.has(file));
  }

  async filesForPost(postId: string) {
    const post = toObjectId(postId);
    if (!post) return [];
    return (await this.images.find({ postId: post }, { file: 1 }).lean()).map((image) => image.file);
  }

  async orphans(before: Date) {
    return (await this.images.find({ postId: null, createdAt: { $lt: before } }, { file: 1 }).limit(100).lean()).map((image) => image.file);
  }

  async delete(files: string[]) {
    if (files.length) await this.images.deleteMany({ file: { $in: files } });
  }
}

@Injectable()
export class MongoVideoCache extends VideoCache {
  constructor(@InjectModel(CommunityVideoMeta.name) private readonly videos: Model<CommunityVideoMeta>) {
    super();
  }

  async find(id: string) {
    const video = await this.videos.findOne({ videoId: id }).lean();
    return video && { title: video.title ?? null, author: video.author ?? null };
  }

  async save(id: string, meta: { title: string | null; author: string | null }) {
    await this.videos.updateOne({ videoId: id }, { $set: meta }, { upsert: true });
  }
}
