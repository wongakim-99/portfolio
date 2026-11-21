import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import type { CommunityIdentity } from '../community/community-auth.service.js';
import { CommunityMailService } from '../community/community-mail.service.js';
import { CommunityUser } from '../community/community.schemas.js';
import { avatarUrl } from '../community/community-storage.service.js';
import type { AccessRequestDto, WriteBlogPostDto } from './blog.dto.js';
import { BlogAccessRequest, BlogGrant, BlogPost, VISIBILITIES, type Visibility } from './blog.schemas.js';

// 거절된 요청을 다시 보낼 수 있을 때까지
const RETRY_AFTER_MS = 3 * 24 * 60 * 60_000;
// 읽는 시간은 한글 기준 1분에 500자쯤으로 셈
const CHARS_PER_MINUTE = 500;
const readMinutes = (body: string) => Math.max(1, Math.round(body.length / CHARS_PER_MINUTE));
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 목록 거르기. tag 는 그 태그가 붙은 글, q 는 검색어, visibility 는 공개 범위 하나만 */
export interface ListOptions {
  before?: string;
  tag?: string;
  q?: string;
  visibility?: string;
}

type Viewer = CommunityIdentity | null;
type Readable = { _id: Types.ObjectId; visibility: Visibility };
/** 이 회원이 받은 허락. all 이면 approved 글 전부 */
type Grants = { all: boolean; posts: Set<string> };

function objectId(value: string, missing = '글을 찾을 수 없습니다.'): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new NotFoundException(missing);
  return new Types.ObjectId(value);
}

// 블로그 주인은 blog:write 권한으로 알아봄. 주인은 나만 보기 글까지 모두 읽음
const isOwner = (viewer: Viewer) => Boolean(viewer?.permissions.includes('blog:write'));

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(BlogPost.name) private readonly posts: Model<BlogPost>,
    @InjectModel(BlogAccessRequest.name) private readonly requests: Model<BlogAccessRequest>,
    @InjectModel(BlogGrant.name) private readonly grants: Model<BlogGrant>,
    @InjectModel(CommunityUser.name) private readonly users: Model<CommunityUser>,
    private readonly mail: CommunityMailService,
  ) {}

  private async grantsOf(viewer: Viewer): Promise<Grants> {
    if (!viewer) return { all: false, posts: new Set() };
    const grants = await this.grants.find({ userId: objectId(viewer.id) }, { postId: 1 }).lean();
    return {
      all: grants.some((grant) => grant.postId === null),
      posts: new Set(grants.filter((grant) => grant.postId).map((grant) => String(grant.postId))),
    };
  }

  private canRead(post: Readable, viewer: Viewer, grants: Grants): boolean {
    if (post.visibility === 'public' || isOwner(viewer)) return true;
    if (post.visibility === 'private') return false;
    return grants.all || grants.posts.has(String(post._id));
  }

  // 이 사람에게 목록으로 보여도 되는 글. 나만 보기 글은 주인에게만
  private visibleTo(viewer: Viewer): QueryFilter<BlogPost> {
    return isOwner(viewer) ? {} : { visibility: { $ne: 'private' as const } };
  }

  // 잠긴 글도 목록에는 제목과 태그가 보임. 검색은 잠긴 글이면 제목과 태그만 뒤지고 본문은 보지 않음
  async list(viewer: Viewer, { before, tag, q, visibility }: ListOptions = {}) {
    const and: QueryFilter<BlogPost>[] = [this.visibleTo(viewer)];
    if (before) and.push({ _id: { $lt: objectId(before) } });
    if (tag) and.push({ tags: tag });
    if (visibility && (VISIBILITIES as readonly string[]).includes(visibility)) and.push({ visibility: visibility as Visibility });
    const query = q?.trim().slice(0, 40);
    if (query) {
      const pattern = new RegExp(escapeRegex(query), 'i');
      and.push({ $or: [
        { title: pattern }, { tags: pattern },
        isOwner(viewer) ? { body: pattern } : { visibility: 'public' as const, body: pattern },
      ] });
    }
    const results = await this.posts.find({ $and: and }, { title: 1, body: 1, visibility: 1, tags: 1, createdAt: 1, updatedAt: 1 })
      .sort({ _id: -1 }).limit(11).lean();
    const page = results.slice(0, 10);
    const grants = await this.grantsOf(viewer);
    return {
      posts: page.map((post) => {
        const readable = this.canRead(post, viewer, grants);
        return {
          id: String(post._id), title: post.title, visibility: post.visibility, locked: !readable, tags: post.tags ?? [],
          excerpt: readable ? post.body.slice(0, 220) : null, readMinutes: readable ? readMinutes(post.body) : null,
          createdAt: post.createdAt, updatedAt: post.updatedAt,
        };
      }),
      nextCursor: results.length > 10 ? String(page.at(-1)!._id) : null,
    };
  }

  // 목록 옆 사이드바: 공개 범위별 글 수, 많이 쓴 태그, 블로그 주인 소개
  async summary(viewer: Viewer) {
    const visible = this.visibleTo(viewer);
    const [counts, tags, owner] = await Promise.all([
      this.posts.aggregate<{ _id: Visibility; count: number }>([{ $match: visible }, { $group: { _id: '$visibility', count: { $sum: 1 } } }]),
      this.posts.aggregate<{ _id: string; count: number }>([
        { $match: visible }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } }, { $limit: 30 },
      ]),
      this.users.findOne({ role: 'owner', verifiedAt: { $ne: null } }, { name: 1, bio: 1, avatar: 1 }).sort({ _id: 1 }).lean(),
    ]);
    const byVisibility = Object.fromEntries(counts.map((item) => [item._id, item.count])) as Partial<Record<Visibility, number>>;
    return {
      total: counts.reduce((sum, item) => sum + item.count, 0),
      public: byVisibility.public ?? 0,
      approved: byVisibility.approved ?? 0,
      private: isOwner(viewer) ? (byVisibility.private ?? 0) : null,
      tags: tags.map((item) => ({ name: item._id, count: item.count })),
      owner: owner ? { id: String(owner._id), name: owner.name, bio: owner.bio ?? '', avatarUrl: avatarUrl(owner.avatar) } : null,
    };
  }

  // 못 읽는 글은 본문 대신 null 과, 로그인했다면 내가 보낸 요청의 상태를 줌
  async get(id: string, viewer: Viewer) {
    const post = await this.posts.findById(objectId(id)).lean();
    if (!post || (post.visibility === 'private' && !isOwner(viewer))) throw new NotFoundException('글을 찾을 수 없습니다.');
    const readable = this.canRead(post, viewer, await this.grantsOf(viewer));
    return {
      id: String(post._id), title: post.title, visibility: post.visibility, locked: !readable, tags: post.tags ?? [],
      body: readable ? post.body : null, readMinutes: readable ? readMinutes(post.body) : null,
      createdAt: post.createdAt, updatedAt: post.updatedAt,
      request: !readable && viewer ? await this.requestState(viewer.id, post._id) : null,
    };
  }

  private async requestState(userId: string, postId: Types.ObjectId) {
    const request = await this.requests.findOne({ userId: objectId(userId), postId }).lean();
    if (!request) return null;
    const retryAt = request.status === 'rejected' && request.decidedAt ? new Date(request.decidedAt.getTime() + RETRY_AFTER_MS) : null;
    return { status: request.status, createdAt: request.createdAt, retryAt };
  }

  async create(dto: WriteBlogPostDto, author: CommunityIdentity) {
    const post = await this.posts.create({
      title: dto.title, body: dto.body, visibility: dto.visibility, tags: dto.tags ?? [], authorId: objectId(author.id),
    });
    return this.get(String(post._id), author);
  }

  async edit(id: string, dto: WriteBlogPostDto, author: CommunityIdentity) {
    const post = await this.posts.findById(objectId(id));
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    post.title = dto.title;
    post.body = dto.body;
    post.visibility = dto.visibility;
    post.tags = dto.tags ?? [];
    await post.save();
    // 공개하거나 나만 보기로 돌리면 이 글에 온 요청은 더 기다릴 일이 없음
    if (dto.visibility !== 'approved') await this.requests.deleteMany({ postId: post._id });
    return this.get(id, author);
  }

  async remove(id: string): Promise<void> {
    const post = await this.posts.findByIdAndDelete(objectId(id));
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    await Promise.all([this.requests.deleteMany({ postId: post._id }), this.grants.deleteMany({ postId: post._id })]);
  }

  async requestAccess(id: string, viewer: CommunityIdentity, dto: AccessRequestDto) {
    const post = await this.posts.findById(objectId(id)).lean();
    if (!post || post.visibility === 'private') throw new NotFoundException('글을 찾을 수 없습니다.');
    if (this.canRead(post, viewer, await this.grantsOf(viewer))) throw new ConflictException('이미 읽을 수 있는 글입니다.');
    const userId = objectId(viewer.id);
    const existing = await this.requests.findOne({ userId, postId: post._id }).lean();
    if (existing?.status === 'pending') throw new ConflictException('이미 요청을 보냈습니다. 주인장이 확인할 때까지 기다려 주세요.');
    if (existing?.decidedAt && existing.decidedAt.getTime() + RETRY_AFTER_MS > Date.now()) {
      throw new ConflictException('거절된 요청은 3일 뒤에 다시 보낼 수 있습니다.');
    }
    // 다시 보내는 요청은 새로 받은 것처럼 목록 맨 위에 오도록 지우고 새로 만듦
    if (existing) await this.requests.deleteOne({ _id: existing._id });
    try {
      await this.requests.create({ userId, postId: post._id, message: dto.message ?? '' });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictException('이미 요청을 보냈습니다. 주인장이 확인할 때까지 기다려 주세요.');
      }
      throw error;
    }
    this.notifyOwners(viewer.name, post.title);
    return this.requestState(viewer.id, post._id);
  }

  // 메일은 기다리지 않고 보냄. 못 보내도 요청은 관리실에 남아 있음
  private notifyOwners(requester: string, postTitle: string): void {
    if (!this.mail.ready) return;
    this.users.find({ role: 'owner', verifiedAt: { $ne: null } }, { email: 1 }).lean()
      .then((owners) => Promise.all(owners.map((owner) => this.mail.sendBlogRequest(owner.email, requester, postTitle))))
      .catch(() => {});
  }

  private async people(ids: Types.ObjectId[]) {
    const users = await this.users.find({ _id: { $in: ids } }, { name: 1, avatar: 1 }).lean();
    return new Map(users.map((user) => [String(user._id), { id: String(user._id), name: user.name, avatarUrl: avatarUrl(user.avatar) }]));
  }

  private async titles(ids: Types.ObjectId[]) {
    const posts = await this.posts.find({ _id: { $in: ids } }, { title: 1 }).lean();
    return new Map(posts.map((post) => [String(post._id), { id: String(post._id), title: post.title }]));
  }

  async pendingRequests() {
    const requests = await this.requests.find({ status: 'pending' }).sort({ _id: -1 }).limit(100).lean();
    const [users, posts] = await Promise.all([this.people(requests.map((item) => item.userId)), this.titles(requests.map((item) => item.postId))]);
    return requests.flatMap((request) => {
      const user = users.get(String(request.userId));
      const post = posts.get(String(request.postId));
      return user && post ? [{ id: String(request._id), message: request.message, createdAt: request.createdAt, user, post }] : [];
    });
  }

  // scope 가 all 이면 그 회원은 approved 글을 전부 읽게 되므로 다른 요청도 같이 정리함
  async approve(id: string, scope: 'post' | 'all'): Promise<void> {
    const request = await this.requests.findOne({ _id: objectId(id, '요청을 찾을 수 없습니다.'), status: 'pending' }).lean();
    if (!request) throw new NotFoundException('요청을 찾을 수 없습니다.');
    const postId = scope === 'all' ? null : request.postId;
    await this.grants.updateOne({ userId: request.userId, postId }, { $setOnInsert: { userId: request.userId, postId } }, { upsert: true });
    await this.requests.deleteMany(scope === 'all' ? { userId: request.userId } : { _id: request._id });
    this.notifyGranted(request.userId, scope === 'all' ? null : request.postId, request.postId);
  }

  private notifyGranted(userId: Types.ObjectId, grantedPostId: Types.ObjectId | null, requestedPostId: Types.ObjectId): void {
    if (!this.mail.ready) return;
    Promise.all([
      this.users.findOne({ _id: userId, verifiedAt: { $ne: null } }, { email: 1, name: 1 }).lean(),
      grantedPostId ? this.posts.findById(grantedPostId, { title: 1 }).lean() : null,
    ])
      .then(([user, post]) => user && this.mail.sendBlogGranted(user.email, user.name, post?.title ?? null, String(requestedPostId)))
      .catch(() => {});
  }

  async reject(id: string): Promise<void> {
    const request = await this.requests.findOneAndUpdate(
      { _id: objectId(id, '요청을 찾을 수 없습니다.'), status: 'pending' }, { $set: { status: 'rejected', decidedAt: new Date() } },
    );
    if (!request) throw new NotFoundException('요청을 찾을 수 없습니다.');
  }

  // post 가 null 이면 허락받은 사람만 보는 글 전부
  async grantList() {
    const grants = await this.grants.find().sort({ _id: -1 }).limit(200).lean();
    const postIds = grants.flatMap((grant) => (grant.postId ? [grant.postId] : []));
    const [users, posts] = await Promise.all([this.people(grants.map((grant) => grant.userId)), this.titles(postIds)]);
    return grants.flatMap((grant) => {
      const user = users.get(String(grant.userId));
      const post = grant.postId ? posts.get(String(grant.postId)) : null;
      return user && post !== undefined ? [{ id: String(grant._id), createdAt: grant.createdAt, user, post }] : [];
    });
  }

  async revoke(id: string): Promise<void> {
    const result = await this.grants.deleteOne({ _id: objectId(id, '허락을 찾을 수 없습니다.') });
    if (!result.deletedCount) throw new NotFoundException('허락을 찾을 수 없습니다.');
  }
}
