import { Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import { UserDirectory, type Identity } from '../../identity/index.js';
import {
  canRead, EXCERPT_LENGTH, isVisible, POSTS_PER_PAGE, readMinutes, retryAt, VISIBILITIES, type BlogPost, type Visibility,
} from '../domain/blog.js';
import { AccessRequestRepository, BlogPostRepository, GrantRepository } from '../domain/blog.ports.js';
import { readerOf, ReaderAccess } from './reader-access.js';

const POST_MISSING = '글을 찾을 수 없습니다.';
const SIDEBAR_TAGS = 30;

/** 목록 거르기. tag 는 그 태그가 붙은 글, q 는 검색어, visibility 는 공개 범위 하나만 */
export interface ListOptions {
  before?: string;
  tag?: string;
  q?: string;
  visibility?: string;
}

export interface BlogPostInput {
  title: string;
  body: string;
  visibility: Visibility;
  tags?: string[];
}

// 블로그 글 읽기, 쓰기. 잠긴 글도 목록에는 제목과 태그가 보이고 본문만 숨김
@Injectable()
export class BlogPostsService {
  constructor(
    private readonly posts: BlogPostRepository,
    private readonly requests: AccessRequestRepository,
    private readonly grants: GrantRepository,
    private readonly access: ReaderAccess,
    private readonly directory: UserDirectory,
  ) {}

  // 검색은 잠긴 글이면 제목과 태그만 뒤지고 본문은 보지 않음
  async list(viewer: Identity | null, { before, tag, q, visibility }: ListOptions = {}) {
    const reader = readerOf(viewer);
    const query = q?.trim().slice(0, 40);
    const results = await this.posts.list({
      includePrivate: Boolean(reader?.owner),
      before: before && requireEntityId(before, POST_MISSING),
      tag,
      visibility: visibility && (VISIBILITIES as readonly string[]).includes(visibility) ? (visibility as Visibility) : undefined,
      search: query ? { text: query, bodyScope: reader?.owner ? 'all' : 'public' } : undefined,
    }, POSTS_PER_PAGE + 1);
    const page = results.slice(0, POSTS_PER_PAGE);
    const grants = await this.access.grantsOf(reader);
    return {
      posts: page.map((post) => {
        const readable = canRead(post, reader, grants);
        return {
          id: post.id, title: post.title, visibility: post.visibility, locked: !readable, tags: post.tags,
          excerpt: readable ? post.body.slice(0, EXCERPT_LENGTH) : null, readMinutes: readable ? readMinutes(post.body) : null,
          createdAt: post.createdAt, updatedAt: post.updatedAt,
        };
      }),
      nextCursor: results.length > POSTS_PER_PAGE ? page.at(-1)!.id : null,
    };
  }

  // 목록 옆 사이드바: 공개 범위별 글 수, 많이 쓴 태그, 블로그 주인 소개
  async summary(viewer: Identity | null) {
    const owner = Boolean(readerOf(viewer)?.owner);
    const [{ byVisibility, tags }, owners] = await Promise.all([this.posts.counts(owner, SIDEBAR_TAGS), this.directory.owners()]);
    const first = owners[0];
    return {
      total: Object.values(byVisibility).reduce((sum, count) => sum + (count ?? 0), 0),
      public: byVisibility.public ?? 0,
      approved: byVisibility.approved ?? 0,
      private: owner ? (byVisibility.private ?? 0) : null,
      tags,
      owner: first ? { id: first.id, name: first.name, bio: first.bio, avatarUrl: first.avatarUrl } : null,
    };
  }

  private async find(id: string): Promise<BlogPost> {
    const post = await this.posts.findById(requireEntityId(id, POST_MISSING));
    if (!post) throw new NotFoundException(POST_MISSING);
    return post;
  }

  // 못 읽는 글은 본문 대신 null 과, 로그인했다면 내가 보낸 요청의 상태를 줌
  async get(id: string, viewer: Identity | null) {
    const reader = readerOf(viewer);
    const post = await this.find(id);
    if (!isVisible(post, reader)) throw new NotFoundException(POST_MISSING);
    const readable = canRead(post, reader, await this.access.grantsOf(reader));
    return {
      id: post.id, title: post.title, visibility: post.visibility, locked: !readable, tags: post.tags,
      body: readable ? post.body : null, readMinutes: readable ? readMinutes(post.body) : null,
      createdAt: post.createdAt, updatedAt: post.updatedAt,
      request: !readable && reader ? await this.requestState(reader.id, post.id) : null,
    };
  }

  async requestState(userId: string, postId: string) {
    const request = await this.requests.find(userId, postId);
    return request && { status: request.status, createdAt: request.createdAt, retryAt: retryAt(request) };
  }

  async create(input: BlogPostInput, author: Identity) {
    const post = await this.posts.create({
      title: input.title, body: input.body, visibility: input.visibility, tags: input.tags ?? [], authorId: author.id,
    });
    return this.get(post.id, author);
  }

  async edit(id: string, input: BlogPostInput, author: Identity) {
    const post = await this.find(id);
    await this.posts.update(post.id, { title: input.title, body: input.body, visibility: input.visibility, tags: input.tags ?? [] });
    // 공개하거나 나만 보기로 돌리면 이 글에 온 요청은 더 기다릴 일이 없음
    if (input.visibility !== 'approved') await this.requests.deleteForPost(post.id);
    return this.get(post.id, author);
  }

  // 글을 지우면 그 글에 온 요청과 그 글만 허락한 것도 같이 지움
  async remove(id: string): Promise<void> {
    if (!(await this.posts.delete(requireEntityId(id, POST_MISSING)))) throw new NotFoundException(POST_MISSING);
    await Promise.all([this.requests.deleteForPost(id), this.grants.deleteForPost(id)]);
  }
}
