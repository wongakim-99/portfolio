import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { asObjectId, isDuplicateKey, toObjectId } from '../../../../shared/infrastructure/mongo.js';
import {
  NO_ROOM, type AccessRequest, type BlogDraft, type BlogPost, type BlogPostContent, type BlogRoom, type Grant, type Visibility,
} from '../../domain/blog.js';
import {
  AccessRequestRepository, BlogDraftRepository, BlogImageRepository, BlogPostRepository, BlogRoomRepository, GrantRepository,
  ProofUsageRepository, WritingLogRepository, type BlogListFilter,
} from '../../domain/blog.ports.js';
import {
  BlogAccessRequest, BlogDraft as BlogDraftDoc, BlogGrant, BlogImage, BlogPost as BlogPostDoc, BlogProofUsage, BlogRoom as BlogRoomDoc,
  BlogWritingDay,
} from './blog.schemas.js';

type Doc<T> = T & { _id: unknown };

const toPost = (doc: Doc<BlogPostDoc>): BlogPost => ({
  id: String(doc._id), authorId: String(doc.authorId), title: doc.title, body: doc.body, visibility: doc.visibility,
  tags: doc.tags ?? [], cover: doc.cover ?? null, roomId: doc.roomId ? String(doc.roomId) : null, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
});
const toDraft = (doc: Doc<BlogDraftDoc>): BlogDraft => ({
  authorId: String(doc.authorId), postId: doc.postId ? String(doc.postId) : null, title: doc.title ?? '', body: doc.body ?? '',
  visibility: doc.visibility, tags: doc.tags ?? [], cover: doc.cover ?? null, roomId: doc.roomId ? String(doc.roomId) : null, updatedAt: doc.updatedAt,
});
const toRoom = (doc: Doc<BlogRoomDoc>): BlogRoom => ({ id: String(doc._id), name: doc.name, order: doc.order ?? 0, createdAt: doc.createdAt });
// 방이 생기기 전의 글은 roomId 가 아예 없어서, null 과 없는 필드를 같이 '방 없음' 으로 셈
const roomFilter = (room: string | null): QueryFilter<BlogPostDoc> => (room === null ? { roomId: null } : { roomId: toObjectId(room) });
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

  async list({ includePrivate, before, tag, visibility, room, search }: BlogListFilter, limit: number) {
    const and: QueryFilter<BlogPostDoc>[] = [visibleFilter(includePrivate)];
    if (before) and.push({ _id: { $lt: toObjectId(before) } });
    if (tag) and.push({ tags: tag });
    if (visibility) and.push({ visibility });
    if (room !== undefined) and.push(roomFilter(room));
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
    const [counts, rooms, tags] = await Promise.all([
      this.posts.aggregate<{ _id: Visibility; count: number }>([{ $match: visible }, { $group: { _id: '$visibility', count: { $sum: 1 } } }]),
      this.posts.aggregate<{ _id: unknown; count: number }>([{ $match: visible }, { $group: { _id: { $ifNull: ['$roomId', null] }, count: { $sum: 1 } } }]),
      // 태그가 필요 없으면(tagLimit 0) 태그는 세지 않음. $limit 은 0 을 받지 않음
      tagLimit > 0
        ? this.posts.aggregate<{ _id: string; count: number }>([
          { $match: visible }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } }, { $limit: tagLimit },
        ])
        : Promise.resolve([]),
    ]);
    return {
      byVisibility: Object.fromEntries(counts.map((item) => [item._id, item.count])) as Partial<Record<Visibility, number>>,
      byRoom: Object.fromEntries(rooms.map((item) => [item._id ? String(item._id) : NO_ROOM, item.count])),
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
    const post = await this.posts.create({ ...input, authorId: asObjectId(input.authorId), roomId: input.roomId ? asObjectId(input.roomId) : null });
    return toPost(post.toObject());
  }

  async update(id: string, input: BlogPostContent) {
    await this.posts.updateOne({ _id: toObjectId(id) }, { $set: { ...input, roomId: input.roomId ? asObjectId(input.roomId) : null } });
  }

  async delete(id: string) {
    return Boolean(await this.posts.findByIdAndDelete(toObjectId(id)));
  }

  async createdBetween(from: Date, to: Date, includePrivate: boolean) {
    const posts = await this.posts.find({ $and: [visibleFilter(includePrivate), { createdAt: { $gte: from, $lt: to } }] }).sort({ createdAt: 1 }).lean();
    return posts.map(toPost);
  }

  async withoutRoom(limit: number) {
    return (await this.posts.find(roomFilter(null)).sort({ _id: -1 }).limit(limit).lean()).map(toPost);
  }

  async assignRooms(assignments: { postId: string; roomId: string }[]) {
    if (!assignments.length) return 0;
    const result = await this.posts.bulkWrite(assignments.map(({ postId, roomId }) => ({
      updateOne: { filter: { _id: asObjectId(postId) }, update: { $set: { roomId: asObjectId(roomId) } } },
    })));
    return result.matchedCount;
  }

  async clearRoom(roomId: string) {
    await this.posts.updateMany({ roomId: asObjectId(roomId) }, { $set: { roomId: null } });
  }
}

@Injectable()
export class MongoWritingLogRepository extends WritingLogRepository {
  constructor(@InjectModel(BlogWritingDay.name) private readonly days: Model<BlogWritingDay>) {
    super();
  }

  async add(authorId: string, byDay: Map<string, number[]>) {
    if (!byDay.size) return;
    const author = asObjectId(authorId);
    await this.days.bulkWrite([...byDay].map(([day, minutes]) => ({
      updateOne: { filter: { authorId: author, day }, update: { $addToSet: { minutes: { $each: minutes } } }, upsert: true },
    })));
  }

  async between(first: string, last: string) {
    return this.days.aggregate<{ day: string; minutes: number }>([
      { $match: { day: { $gte: first, $lte: last } } },
      { $group: { _id: '$day', minutes: { $sum: { $size: '$minutes' } } } },
      { $project: { _id: 0, day: '$_id', minutes: 1 } },
      { $sort: { day: 1 } },
    ]);
  }
}

@Injectable()
export class MongoBlogDraftRepository extends BlogDraftRepository {
  constructor(@InjectModel(BlogDraftDoc.name) private readonly drafts: Model<BlogDraftDoc>) {
    super();
  }

  private key(authorId: string, postId: string | null) {
    return { authorId: asObjectId(authorId), postId: postId ? asObjectId(postId) : null };
  }

  async find(authorId: string, postId: string | null) {
    const draft = await this.drafts.findOne(this.key(authorId, postId)).lean();
    return draft && toDraft(draft);
  }

  async save(authorId: string, postId: string | null, content: BlogPostContent) {
    const update = { $set: { ...content, roomId: content.roomId ? asObjectId(content.roomId) : null } };
    const upsert = () => this.drafts.findOneAndUpdate(this.key(authorId, postId), update, { upsert: true, returnDocument: 'after' }).lean();
    try {
      return toDraft((await upsert())!);
    } catch (error) {
      // 두 창이 한꺼번에 처음 저장하면 하나는 유일 인덱스에 걸림. 그때는 먼저 생긴 문서를 덮어씀
      if (!isDuplicateKey(error)) throw error;
      return toDraft((await upsert())!);
    }
  }

  async delete(authorId: string, postId: string | null) {
    await this.drafts.deleteOne(this.key(authorId, postId));
  }

  async deleteForPost(postId: string) {
    await this.drafts.deleteMany({ postId: asObjectId(postId) });
  }

  async contents() {
    return (await this.drafts.find({}, { body: 1, cover: 1 }).lean()).map((draft) => ({ body: draft.body ?? '', cover: draft.cover ?? null }));
  }
}

@Injectable()
export class MongoBlogRoomRepository extends BlogRoomRepository {
  constructor(@InjectModel(BlogRoomDoc.name) private readonly rooms: Model<BlogRoomDoc>) {
    super();
  }

  async list() {
    return (await this.rooms.find().sort({ order: 1, _id: 1 }).lean()).map(toRoom);
  }

  async create(name: string, order: number) {
    try {
      return toRoom((await this.rooms.create({ name, order })).toObject());
    } catch (error) {
      if (isDuplicateKey(error)) return null;
      throw error;
    }
  }

  async rename(id: string, name: string) {
    const room = toObjectId(id);
    if (!room) return null;
    try {
      return (await this.rooms.updateOne({ _id: room }, { $set: { name } })).matchedCount ? true : null;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async reorder(ids: string[]) {
    if (!ids.length) return;
    await this.rooms.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: asObjectId(id) }, update: { $set: { order } } } })));
  }

  async delete(id: string) {
    const room = toObjectId(id);
    return Boolean(room && (await this.rooms.findByIdAndDelete(room)));
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

@Injectable()
export class MongoBlogImageRepository extends BlogImageRepository {
  constructor(@InjectModel(BlogImage.name) private readonly images: Model<BlogImage>) {
    super();
  }

  async create(input: { file: string; size: number }) {
    await this.images.create({ ...input, postId: null });
  }

  async attach(files: string[], postId: string) {
    if (!files.length) return;
    const post = asObjectId(postId);
    await this.images.updateMany({ file: { $in: files }, $or: [{ postId: null }, { postId: post }] }, { $set: { postId: post } });
  }

  async filesForPost(postId: string) {
    const post = toObjectId(postId);
    if (!post) return [];
    return (await this.images.find({ postId: post }, { file: 1 }).lean()).map((image) => image.file);
  }

  async orphans(before: Date, keep: string[]) {
    return (await this.images.find({ postId: null, createdAt: { $lt: before }, file: { $nin: keep } }, { file: 1 }).limit(100).lean())
      .map((image) => image.file);
  }

  async delete(files: string[]) {
    if (files.length) await this.images.deleteMany({ file: { $in: files } });
  }
}

const DAY_MS = 86_400_000;

@Injectable()
export class MongoProofUsageRepository extends ProofUsageRepository {
  constructor(@InjectModel(BlogProofUsage.name) private readonly usage: Model<BlogProofUsage>) {
    super();
  }

  // 방문자 한도를 먼저 보고, 남았을 때만 사이트 전체를 셈. 전체 한도가 찬 날 쓴 방문자 횟수는 돌려주지 않음(그날은 어차피 못 씀)
  async take(day: string, visitor: string, limits: { total: number; perVisitor: number }) {
    const expireAt = new Date(Date.parse(`${day}T00:00:00+09:00`) + 2 * DAY_MS);
    if ((await this.bump(`${day}:${visitor}`, limits.perVisitor, expireAt)) === null) return null;
    return this.bump(day, limits.total, expireAt);
  }

  async total(day: string) {
    return (await this.usage.findById(day, { count: 1 }).lean())?.count ?? 0;
  }

  // 한도보다 적을 때만 하나 올림. 한도에 닿은 문서는 조건에 안 맞아 새로 만들려다 같은 _id 로 막힘(E11000) = 한도 넘음
  // 그날 첫 요청 두 개가 동시에 문서를 만들면 하나가 E11000 을 받으므로 한 번 더 해 봄
  private async bump(id: string, limit: number, expireAt: Date): Promise<number | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const doc = await this.usage
          .findOneAndUpdate({ _id: id, count: { $lt: limit } }, { $inc: { count: 1 }, $setOnInsert: { expireAt } }, { upsert: true, returnDocument: 'after' })
          .lean();
        return doc?.count ?? null;
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
      }
    }
    return null;
  }
}
