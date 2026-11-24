import { Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import type { Identity } from '../../identity/index.js';
import { NEW_DRAFT, type BlogPostContent } from '../domain/blog.js';
import { BlogDraftRepository, BlogPostRepository } from '../domain/blog.ports.js';
import { BlogRoomsService } from './blog-rooms.service.js';

const POST_MISSING = '글을 찾을 수 없습니다.';

/** 화면에 보내는 임시 글. savedAt 은 마지막으로 저장한 때 */
export type DraftView = BlogPostContent & { savedAt: string };

// 글쓰기 화면의 임시저장. 쓰는 동안 주기적으로 덮어쓰고, 다른 기기에서 글쓰기를 열면 이어 씀
// 글을 올리거나 고쳐 저장하면 BlogPostsService 가 지움
@Injectable()
export class BlogDraftsService {
  constructor(
    private readonly drafts: BlogDraftRepository,
    private readonly posts: BlogPostRepository,
    private readonly rooms: BlogRoomsService,
  ) {}

  async get(key: string, author: Identity): Promise<DraftView | null> {
    const draft = await this.drafts.find(author.id, await this.postOf(key));
    if (!draft) return null;
    // 저장한 뒤 지워진 방은 비워서 돌려줌. 그대로 두면 글을 올릴 때 없는 방이라 막힘
    const roomId = draft.roomId && (await this.rooms.list()).some((room) => room.id === draft.roomId) ? draft.roomId : null;
    const { title, body, visibility, tags, cover } = draft;
    return { title, body, visibility, tags, cover, roomId, savedAt: draft.updatedAt.toISOString() };
  }

  async save(key: string, content: BlogPostContent, author: Identity): Promise<{ savedAt: string }> {
    const draft = await this.drafts.save(author.id, await this.postOf(key), content);
    return { savedAt: draft.updatedAt.toISOString() };
  }

  async discard(key: string, author: Identity): Promise<void> {
    await this.drafts.delete(author.id, await this.postOf(key));
  }

  // 새 글이면 null, 고치는 글이면 있는 글인지 확인한 ID
  private async postOf(key: string): Promise<string | null> {
    if (key === NEW_DRAFT) return null;
    const id = requireEntityId(key, POST_MISSING);
    if (!(await this.posts.findById(id))) throw new NotFoundException(POST_MISSING);
    return id;
  }
}
