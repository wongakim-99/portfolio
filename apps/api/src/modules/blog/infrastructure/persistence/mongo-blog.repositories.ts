import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { asObjectId, isDuplicateKey, toObjectId } from '../../../../shared/infrastructure/mongo.js';
import type { AccessRequest, BlogPost, Grant, Visibility } from '../../domain/blog.js';
import { AccessRequestRepository, BlogPostRepository, GrantRepository, type BlogListFilter } from '../../domain/blog.ports.js';
import { BlogAccessRequest, BlogGrant, BlogPost as BlogPostDoc } from './blog.schemas.js';

type Doc<T> = T & { _id: unknown };

const toPost = (doc: Doc<BlogPostDoc>): BlogPost => ({
  id: String(doc._id), authorId: String(doc.authorId), title: doc.title, body: doc.body, visibility: doc.visibility,
  tags: doc.tags ?? [], createdAt: doc.createdAt, updatedAt: doc.updatedAt,
});
const toRequest = (doc: Doc<BlogAccessRequest>): AccessRequest => ({
  id: String(doc._id), userId: String(doc.userId), postId: String(doc.postId), message: doc.message ?? '', status: doc.status,
  decidedAt: doc.decidedAt ?? null, createdAt: doc.createdAt,
});
const toGrant = (doc: Doc<BlogGrant>): Grant => ({
  id: String(doc._id), userId: String(doc.userId), postId: doc.postId ? String(doc.postId) : null, createdAt: doc.createdAt,
});
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const visibleFilter = (includePrivate: boolean): QueryFilter<BlogPostDoc> => (includePrivate ? {} : { visibility: { $ne: 'private' as const } });

@Injectable()
export class MongoBlogPostRepository extends BlogPostRepository {
  constructor(@InjectModel(BlogPostDoc.name) private readonly posts: Model<BlogPostDoc>) {
    super();
  }

  async list({ includePrivate, before, tag, visibility, search }: BlogListFilter, limit: number) {
    const and: QueryFilter<BlogPostDoc>[] = [visibleFilter(includePrivate)];
    if (before) and.push({ _id: { $lt: toObjectId(before) } });
    if (tag) and.push({ tags: tag });
    if (visibility) and.push({ visibility });
    if (search) {
      const pattern = new RegExp(escapeRegex(search.text), 'i');
      and.push({ $or: [
        { title: pattern }, { tags: pattern },
        search.bodyScope === 'all' ? { body: pattern } : { visibility: 'public' as const, body: pattern },
      ] });
    }
    return (await this.posts.find({ $and: and }).sort({ _id: -1 }).limit(limit).lean()).map(toPost);
  }

  async counts(includePrivate: boolean, tagLimit: number) {
    const visible = visibleFilter(includePrivate);
    const [counts, tags] = await Promise.all([
      this.posts.aggregate<{ _id: Visibility; count: number }>([{ $match: visible }, { $group: { _id: '$visibility', count: { $sum: 1 } } }]),
      this.posts.aggregate<{ _id: string; count: number }>([
        { $match: visible }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } }, { $limit: tagLimit },
      ]),
    ]);
    return {
      byVisibility: Object.fromEntries(counts.map((item) => [item._id, item.count])) as Partial<Record<Visibility, number>>,
      tags: tags.map((item) => ({ name: item._id, count: item.count })),
    };
  }

  async findById(id: string) {
    const post = await this.posts.findById(toObjectId(id)).lean();
    return post && toPost(post);
  }

  async findMany(ids: string[]) {
    return (await this.posts.find({ _id: { $in: ids.map(toObjectId) } }).lean()).map(toPost);
  }

  async create(input: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>) {
    const post = await this.posts.create({ ...input, authorId: asObjectId(input.authorId) });
    return toPost(post.toObject());
  }

  async update(id: string, input: Pick<BlogPost, 'title' | 'body' | 'visibility' | 'tags'>) {
    await this.posts.updateOne({ _id: toObjectId(id) }, { $set: input });
  }

  async delete(id: string) {
    return Boolean(await this.posts.findByIdAndDelete(toObjectId(id)));
  }
}

@Injectable()
export class MongoAccessRequestRepository extends AccessRequestRepository {
  constructor(@InjectModel(BlogAccessRequest.name) private readonly requests: Model<BlogAccessRequest>) {
    super();
  }

  async find(userId: string, postId: string) {
    const request = await this.requests.findOne({ userId: toObjectId(userId), postId: toObjectId(postId) }).lean();
    return request && toRequest(request);
  }

  async create(input: { userId: string; postId: string; message: string }) {
    try {
      await this.requests.create({ userId: asObjectId(input.userId), postId: asObjectId(input.postId), message: input.message });
      return true;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async delete(id: string) {
    await this.requests.deleteOne({ _id: toObjectId(id) });
  }

  async deleteForPost(postId: string) {
    await this.requests.deleteMany({ postId: toObjectId(postId) });
  }

  async deleteForUser(userId: string) {
    await this.requests.deleteMany({ userId: toObjectId(userId) });
  }

  async pending(limit: number) {
    return (await this.requests.find({ status: 'pending' }).sort({ _id: -1 }).limit(limit).lean()).map(toRequest);
  }

  async findPending(id: string) {
    const request = await this.requests.findOne({ _id: toObjectId(id), status: 'pending' }).lean();
    return request && toRequest(request);
  }

  async reject(id: string, at: Date) {
    return Boolean(await this.requests.findOneAndUpdate({ _id: toObjectId(id), status: 'pending' }, { $set: { status: 'rejected', decidedAt: at } }));
  }
}

@Injectable()
export class MongoGrantRepository extends GrantRepository {
  constructor(@InjectModel(BlogGrant.name) private readonly grants: Model<BlogGrant>) {
    super();
  }

  async forUser(userId: string) {
    return (await this.grants.find({ userId: toObjectId(userId) }).lean()).map(toGrant);
  }

  async grant(userId: string, postId: string | null) {
    const filter = { userId: asObjectId(userId), postId: postId === null ? null : asObjectId(postId) };
    await this.grants.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
  }

  async deleteForPost(postId: string) {
    await this.grants.deleteMany({ postId: toObjectId(postId) });
  }

  async latest(limit: number) {
    return (await this.grants.find().sort({ _id: -1 }).limit(limit).lean()).map(toGrant);
  }

  async delete(id: string) {
    return (await this.grants.deleteOne({ _id: toObjectId(id) })).deletedCount > 0;
  }
}
