import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import { UserDirectory, type Identity } from '../../identity/index.js';
import { canRead, isVisible, RETRY_AFTER_MS } from '../domain/blog.js';
import { AccessRequestRepository, BlogNotifier, BlogPostRepository, GrantRepository } from '../domain/blog.ports.js';
import { BlogPostsService } from './blog-posts.service.js';
import { readerOf, ReaderAccess } from './reader-access.js';

const PENDING_LIMIT = 100;
const GRANT_LIMIT = 200;
const ALREADY_PENDING = '이미 요청을 보냈습니다. 주인장이 확인할 때까지 기다려 주세요.';

// 잠긴 글의 열람 요청과 주인장의 허락, 거절, 허락 거두기
@Injectable()
export class BlogAccessService {
  constructor(
    private readonly posts: BlogPostRepository,
    private readonly requests: AccessRequestRepository,
    private readonly grants: GrantRepository,
    private readonly access: ReaderAccess,
    private readonly blogPosts: BlogPostsService,
    private readonly directory: UserDirectory,
    private readonly notifier: BlogNotifier,
  ) {}

  async requestAccess(postId: string, viewer: Identity, message = '') {
    const reader = readerOf(viewer);
    const post = await this.posts.findById(requireEntityId(postId, '글을 찾을 수 없습니다.'));
    if (!post || post.visibility === 'private' || !isVisible(post, reader)) throw new NotFoundException('글을 찾을 수 없습니다.');
    if (canRead(post, reader, await this.access.grantsOf(reader))) throw new ConflictException('이미 읽을 수 있는 글입니다.');
    const existing = await this.requests.find(viewer.id, post.id);
    if (existing?.status === 'pending') throw new ConflictException(ALREADY_PENDING);
    if (existing?.decidedAt && existing.decidedAt.getTime() + RETRY_AFTER_MS > Date.now()) {
      throw new ConflictException('거절된 요청은 3일 뒤에 다시 보낼 수 있습니다.');
    }
    // 다시 보내는 요청은 새로 받은 것처럼 목록 맨 위에 오도록 지우고 새로 만듦
    if (existing) await this.requests.delete(existing.id);
    if (!(await this.requests.create({ userId: viewer.id, postId: post.id, message }))) throw new ConflictException(ALREADY_PENDING);
    this.notifier.requestReceived(viewer.name, post.title);
    return this.blogPosts.requestState(viewer.id, post.id);
  }

  private async titles(ids: string[]) {
    const posts = await this.posts.findMany(ids);
    return new Map(posts.map((post) => [post.id, { id: post.id, title: post.title }]));
  }

  async pendingRequests() {
    const requests = await this.requests.pending(PENDING_LIMIT);
    const [users, posts] = await Promise.all([
      this.directory.people(requests.map((item) => item.userId)), this.titles(requests.map((item) => item.postId)),
    ]);
    return requests.flatMap((request) => {
      const user = users.get(request.userId);
      const post = posts.get(request.postId);
      return user && post ? [{ id: request.id, message: request.message, createdAt: request.createdAt, user, post }] : [];
    });
  }

  // scope 가 all 이면 그 회원은 approved 글을 전부 읽게 되므로 다른 요청도 같이 정리함
  async approve(id: string, scope: 'post' | 'all'): Promise<void> {
    const request = await this.requests.findPending(requireEntityId(id, '요청을 찾을 수 없습니다.'));
    if (!request) throw new NotFoundException('요청을 찾을 수 없습니다.');
    await this.grants.grant(request.userId, scope === 'all' ? null : request.postId);
    if (scope === 'all') await this.requests.deleteForUser(request.userId);
    else await this.requests.delete(request.id);
    const title = scope === 'all' ? null : ((await this.posts.findById(request.postId))?.title ?? null);
    this.notifier.granted(request.userId, title, request.postId);
  }

  async reject(id: string): Promise<void> {
    if (!(await this.requests.reject(requireEntityId(id, '요청을 찾을 수 없습니다.'), new Date()))) {
      throw new NotFoundException('요청을 찾을 수 없습니다.');
    }
  }

  // post 가 null 이면 허락받은 사람만 보는 글 전부
  async grantList() {
    const grants = await this.grants.latest(GRANT_LIMIT);
    const postIds = grants.flatMap((grant) => (grant.postId ? [grant.postId] : []));
    const [users, posts] = await Promise.all([this.directory.people(grants.map((grant) => grant.userId)), this.titles(postIds)]);
    return grants.flatMap((grant) => {
      const user = users.get(grant.userId);
      const post = grant.postId ? posts.get(grant.postId) : null;
      return user && post !== undefined ? [{ id: grant.id, createdAt: grant.createdAt, user, post }] : [];
    });
  }

  async revoke(id: string): Promise<void> {
    if (!(await this.grants.delete(requireEntityId(id, '허락을 찾을 수 없습니다.')))) throw new NotFoundException('허락을 찾을 수 없습니다.');
  }
}
