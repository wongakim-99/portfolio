import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { NO_ROOM, ROOM_MAX, type BlogRoom } from '../domain/blog.js';
import { plainText } from '../domain/blog-image.js';
import { BlogPostRepository, BlogRoomRepository, RoomClassifier } from '../domain/blog.ports.js';

const ROOM_MISSING = '방을 찾을 수 없습니다.';
// AI 에게 한 번에 맡기는 글 수와 글마다 보내는 본문 길이. 방을 고르는 데는 앞부분이면 충분함
const SUGGEST_BATCH = 30;
const SUGGEST_CHARS = 800;
const SUGGEST_MS = 30_000;

// 블로그 방: 주인장이 관리실에서 만들고 이름, 순서를 정함. 방이 없는 글은 AI 가 방을 추천하고 주인장이 확인해 넣음
@Injectable()
export class BlogRoomsService {
  constructor(
    private readonly rooms: BlogRoomRepository,
    private readonly posts: BlogPostRepository,
    private readonly classifier: RoomClassifier,
  ) {}

  list(): Promise<BlogRoom[]> {
    return this.rooms.list();
  }

  /** 관리실: 방마다 글 수(나만 보기 글 포함)와 아직 방이 없는 글 수 */
  async overview() {
    const [rooms, { byRoom }] = await Promise.all([this.rooms.list(), this.posts.counts(true, 0)]);
    return {
      rooms: rooms.map((room) => ({ id: room.id, name: room.name, count: byRoom[room.id] ?? 0 })),
      unsorted: byRoom[NO_ROOM] ?? 0,
    };
  }

  async create(name: string) {
    const rooms = await this.rooms.list();
    if (rooms.length >= ROOM_MAX) throw new BadRequestException(`방은 ${ROOM_MAX}개까지 만들 수 있습니다.`);
    const room = await this.rooms.create(name, (rooms.at(-1)?.order ?? -1) + 1);
    if (!room) throw new ConflictException('같은 이름의 방이 있습니다.');
    return room;
  }

  async rename(id: string, name: string): Promise<void> {
    const renamed = await this.rooms.rename(id, name);
    if (renamed === null) throw new NotFoundException(ROOM_MISSING);
    if (!renamed) throw new ConflictException('같은 이름의 방이 있습니다.');
  }

  /** 지금 있는 방을 모두 한 번씩 담은 순서만 받음 */
  async reorder(ids: string[]): Promise<void> {
    const current = (await this.rooms.list()).map((room) => room.id);
    if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
      throw new BadRequestException('방 순서를 다시 불러와 주세요.');
    }
    await this.rooms.reorder(ids);
  }

  // 방을 지워도 글은 남고 방 밖(방 없음)으로 나옴
  async remove(id: string): Promise<void> {
    if (!(await this.rooms.list()).some((room) => room.id === id)) throw new NotFoundException(ROOM_MISSING);
    await this.posts.clearRoom(id);
    await this.rooms.delete(id);
  }

  /** 글을 저장할 때 고른 방이 있는 방인지 봄. 없으면 null */
  async requireRoom(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    if (!(await this.rooms.list()).some((room) => room.id === id)) throw new BadRequestException(ROOM_MISSING);
    return id;
  }

  /** 아직 방이 없는 글마다 AI 가 고른 방. 저장은 하지 않고 주인장이 확인한 뒤 assign 으로 넣음 */
  async suggestForUnsorted() {
    const [rooms, posts] = await Promise.all([this.rooms.list(), this.posts.withoutRoom(SUGGEST_BATCH)]);
    if (!rooms.length) throw new BadRequestException('방을 먼저 만들어 주세요.');
    if (!posts.length) return { suggestions: [] };
    const picks = await this.classify(posts.map((post) => ({ id: post.id, title: post.title, tags: post.tags, text: plainText(post.body).slice(0, SUGGEST_CHARS) })), rooms);
    return {
      suggestions: posts.map((post) => ({ post: { id: post.id, title: post.title, visibility: post.visibility }, roomId: picks.get(post.id) ?? null })),
    };
  }

  /** 글쓰기 화면의 'AI 추천'. 쓰고 있는 글(아직 저장 전)에 알맞은 방 */
  async suggestForDraft(draft: { title: string; body: string; tags?: string[] }) {
    const rooms = await this.rooms.list();
    if (!rooms.length) throw new BadRequestException('방을 먼저 만들어 주세요.');
    const picks = await this.classify([{ id: 'draft', title: draft.title, tags: draft.tags ?? [], text: plainText(draft.body).slice(0, SUGGEST_CHARS) }], rooms);
    return { roomId: picks.get('draft') ?? null };
  }

  /** 주인장이 확인한 방을 글에 넣음. 없는 방은 받지 않음 */
  async assign(assignments: { postId: string; roomId: string }[]) {
    const rooms = new Set((await this.rooms.list()).map((room) => room.id));
    if (assignments.some((item) => !rooms.has(item.roomId))) throw new BadRequestException(ROOM_MISSING);
    return { assigned: await this.posts.assignRooms(assignments) };
  }

  private async classify(posts: Parameters<RoomClassifier['suggest']>[0], rooms: BlogRoom[]) {
    const picks = await this.classifier.suggest(posts, rooms, AbortSignal.timeout(SUGGEST_MS)).catch(() => null);
    if (!picks) throw new ServiceUnavailableException('지금은 AI 로 방을 고를 수 없습니다. 잠시 뒤에 다시 해 주세요.');
    return picks;
  }
}
