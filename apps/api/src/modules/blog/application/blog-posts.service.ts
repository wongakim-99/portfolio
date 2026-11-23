import { Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import { UserDirectory, type Identity } from '../../identity/index.js';
import {
  canRead, EXCERPT_LENGTH, isVisible, NO_ROOM, POSTS_PER_PAGE, readMinutes, retryAt, VISIBILITIES, type BlogPost, type BlogRoom, type Visibility,
} from '../domain/blog.js';
import { blogImageUrl, firstImage, plainText } from '../domain/blog-image.js';
import { AccessRequestRepository, BlogPostRepository, GrantRepository } from '../domain/blog.ports.js';
import { isEntityId } from '../../../shared/domain/entity-id.js';
import { BlogImagesService } from './blog-images.service.js';
import { BlogRoomsService } from './blog-rooms.service.js';
import { readerOf, ReaderAccess } from './reader-access.js';

const POST_MISSING = '글을 찾을 수 없습니다.';
const SIDEBAR_TAGS = 30;

/** 목록 거르기. tag 는 그 태그가 붙은 글, q 는 검색어, visibility 는 공개 범위 하나만, room 은 방 ID 하나(none 이면 방 없는 글) */
export interface ListOptions {
  before?: string;
  tag?: string;
  q?: string;
  visibility?: string;
  room?: string;
}

export interface BlogPostInput {
  title: string;
  body: string;
  visibility: Visibility;
  tags?: string[];
  /** 표지 사진 파일. 없으면 본문 첫 사진을 썸네일로 씀 */
  cover?: string | null;
  /** 글이 들 방. 없으면 방 밖(null) */
  roomId?: string | null;
}

// 목록 주소의 ?room= 을 저장소 거르기로. 모양이 틀린 값은 거르지 않음
function roomQuery(room: string | undefined): string | null | undefined {
  if (room === NO_ROOM) return null;
  return room && isEntityId(room) ? room : undefined;
}

// 화면에 보낼 방 이름표. 지워진 방이면 null
const roomLabel = (post: BlogPost, rooms: Map<string, BlogRoom>) => {
  const room = post.roomId ? rooms.get(post.roomId) : undefined;
  return room ? { id: room.id, name: room.name } : null;
};

// 썸네일 주소. 고른 표지가 없으면 본문 첫 사진인데, 잠긴 글은 본문을 못 읽으니 고른 표지만 보여 줌
function coverUrl(post: BlogPost, readable: boolean): string | null {
  const file = post.cover ?? (readable ? firstImage(post.body) : null);
  return file && blogImageUrl(file);
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
    private readonly images: BlogImagesService,
    private readonly rooms: BlogRoomsService,
  ) {}

  private async roomMap() {
    return new Map((await this.rooms.list()).map((room) => [room.id, room]));
  }

  // 검색은 잠긴 글이면 제목과 태그만 뒤지고 본문은 보지 않음
  async list(viewer: Identity | null, { before, tag, q, visibility, room }: ListOptions = {}) {
    const reader = readerOf(viewer);
    const query = q?.trim().slice(0, 40);
    const results = await this.posts.list({
      includePrivate: Boolean(reader?.owner),
      before: before && requireEntityId(before, POST_MISSING),
      tag,
      visibility: visibility && (VISIBILITIES as readonly string[]).includes(visibility) ? (visibility as Visibility) : undefined,
      room: roomQuery(room),
      search: query ? { text: query, bodyScope: reader?.owner ? 'all' : 'public' } : undefined,
    }, POSTS_PER_PAGE + 1);
    const page = results.slice(0, POSTS_PER_PAGE);
    const [grants, rooms] = await Promise.all([this.access.grantsOf(reader), this.roomMap()]);
    return {
      posts: page.map((post) => {
        const readable = canRead(post, reader, grants);
        return {
          id: post.id, title: post.title, visibility: post.visibility, locked: !readable, tags: post.tags, cover: coverUrl(post, readable),
          room: roomLabel(post, rooms),
          excerpt: readable ? plainText(post.body).slice(0, EXCERPT_LENGTH) : null, readMinutes: readable ? readMinutes(post.body) : null,
          createdAt: post.createdAt, updatedAt: post.updatedAt,
        };
      }),
      nextCursor: results.length > POSTS_PER_PAGE ? page.at(-1)!.id : null,
    };
  }

  // 목록 옆 사이드바: 방별 글 수, 공개 범위별 글 수, 많이 쓴 태그, 블로그 주인 소개
  // 방 글 수는 보는 사람에게 보이는 글만 셈 (나만 보기 글은 주인장에게만)
  async summary(viewer: Identity | null) {
    const owner = Boolean(readerOf(viewer)?.owner);
    const [{ byVisibility, byRoom, tags }, owners, rooms] = await Promise.all([
      this.posts.counts(owner, SIDEBAR_TAGS), this.directory.owners(), this.rooms.list(),
    ]);
    const first = owners[0];
    return {
      rooms: rooms.map((room) => ({ id: room.id, name: room.name, count: byRoom[room.id] ?? 0 })),
      unsorted: byRoom[NO_ROOM] ?? 0,
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
    const [grants, rooms] = await Promise.all([this.access.grantsOf(reader), this.roomMap()]);
    const readable = canRead(post, reader, grants);
    return {
      id: post.id, title: post.title, visibility: post.visibility, locked: !readable, tags: post.tags,
      cover: coverUrl(post, readable), coverFile: post.cover, room: roomLabel(post, rooms),
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
    const roomId = await this.rooms.requireRoom(input.roomId);
    const post = await this.posts.create({
      title: input.title, body: input.body, visibility: input.visibility, tags: input.tags ?? [], cover: input.cover ?? null, roomId, authorId: author.id,
    });
    await this.images.syncPost(post.id, post.body, post.cover);
    return this.get(post.id, author);
  }

  async edit(id: string, input: BlogPostInput, author: Identity) {
    const post = await this.find(id);
    const cover = input.cover ?? null;
    // roomId 를 아예 보내지 않으면(예전 화면) 방은 그대로 둠
    const roomId = input.roomId === undefined ? post.roomId : await this.rooms.requireRoom(input.roomId);
    await this.posts.update(post.id, { title: input.title, body: input.body, visibility: input.visibility, tags: input.tags ?? [], cover, roomId });
    // 본문이나 표지에서 뺀 사진은 사진 저장소에서도 지움
    await this.images.syncPost(post.id, input.body, cover);
    // 공개하거나 나만 보기로 돌리면 이 글에 온 요청은 더 기다릴 일이 없음
    if (input.visibility !== 'approved') await this.requests.deleteForPost(post.id);
    return this.get(post.id, author);
  }

  // 글을 지우면 그 글에 온 요청과 그 글만 허락한 것, 그 글의 사진도 같이 지움
  async remove(id: string): Promise<void> {
    if (!(await this.posts.delete(requireEntityId(id, POST_MISSING)))) throw new NotFoundException(POST_MISSING);
    await Promise.all([this.requests.deleteForPost(id), this.grants.deleteForPost(id), this.images.removeForPost(id)]);
  }
}
