import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import { UserDirectory, type Identity } from '../../identity/index.js';
import {
  COMMENTS_PER_PAGE, EXCERPT_LENGTH, isAuthor, POSTS_PER_PAGE, postProblem, type FeedComment, type FeedPost, type LikeTarget,
} from '../domain/feed.js';
import { CommentRepository, LikeRepository, PostRepository, ReportRepository } from '../domain/feed.ports.js';
import { FeedMediaService, photoView, videoView } from './feed-media.service.js';

const POST_MISSING = '글을 찾을 수 없습니다.';
const COMMENT_MISSING = '답글을 찾을 수 없습니다.';

/** 글 쓰기, 고치기에서 받는 것. 제목이 비면 짧은 글 */
export interface PostInput {
  title?: string;
  body: string;
  photos?: string[];
}

// 피드 글과 답글, 좋아요. 글쓴이 사진은 글에 적어 두지 않고 지금 설정된 것을 계정 영역에서 찾아 붙임
// 좋아요를 눌렀는지는 보는 사람마다 달라서 읽을 때 같이 계산함 (로그인 전이면 모두 false)
@Injectable()
export class PostsService {
  constructor(
    private readonly posts: PostRepository,
    private readonly comments: CommentRepository,
    private readonly reports: ReportRepository,
    private readonly likes: LikeRepository,
    private readonly media: FeedMediaService,
    private readonly directory: UserDirectory,
  ) {}

  private async avatars(authorIds: string[]): Promise<Map<string, string | null>> {
    const people = await this.directory.people(authorIds);
    return new Map([...people].map(([id, person]) => [id, person.avatarUrl]));
  }

  private liked(viewer: Identity | null, targetType: LikeTarget, ids: string[]): Promise<Set<string>> {
    return viewer ? this.likes.likedBy(viewer.id, targetType, ids) : Promise.resolve(new Set());
  }

  // 목록에서는 짧은 글은 본문 전부, 제목 있는 긴 글은 앞부분만 보여 줌
  private summary(post: FeedPost, avatar: string | null, liked: boolean) {
    const excerpt = post.title ? post.body.slice(0, EXCERPT_LENGTH) : post.body;
    return {
      id: post.id, title: post.title, excerpt, truncated: excerpt.length < post.body.length,
      photos: post.photos.map(photoView), video: videoView(post.video),
      authorId: post.authorId, authorName: post.authorName, authorAvatarUrl: avatar,
      commentCount: post.commentCount, likeCount: post.likeCount, liked,
      createdAt: post.createdAt, updatedAt: post.updatedAt,
    };
  }

  async list(viewer: Identity | null, before?: string, author?: string) {
    const results = await this.posts.list({
      before: before && requireEntityId(before, POST_MISSING),
      authorId: author && requireEntityId(author, POST_MISSING),
    }, POSTS_PER_PAGE + 1);
    const page = results.slice(0, POSTS_PER_PAGE);
    const [avatars, liked] = await Promise.all([
      this.avatars(page.map((post) => post.authorId)),
      this.liked(viewer, 'post', page.map((post) => post.id)),
    ]);
    return {
      posts: page.map((post) => this.summary(post, avatars.get(post.authorId) ?? null, liked.has(post.id))),
      nextCursor: results.length > POSTS_PER_PAGE ? page.at(-1)!.id : null,
    };
  }

  private async find(id: string): Promise<FeedPost> {
    const post = await this.posts.findById(requireEntityId(id, POST_MISSING));
    if (!post) throw new NotFoundException(POST_MISSING);
    return post;
  }

  async get(id: string, viewer: Identity | null) {
    const post = await this.find(id);
    const [avatars, liked] = await Promise.all([this.avatars([post.authorId]), this.liked(viewer, 'post', [post.id])]);
    const { excerpt: _excerpt, truncated: _truncated, ...rest } = this.summary(post, avatars.get(post.authorId) ?? null, liked.has(post.id));
    return { ...rest, body: post.body };
  }

  private content(input: PostInput) {
    const content = { title: input.title?.trim() ?? '', body: input.body, photos: [...new Set(input.photos ?? [])] };
    const problem = postProblem(content);
    if (problem) throw new BadRequestException(problem);
    return content;
  }

  // 사진은 글이 생긴 뒤에 붙임. 내가 올린 사진만 붙고, 남의 사진 이름을 넣어도 무시됨
  private async photosFor(postId: string, content: { body: string; photos: string[] }, author: Identity) {
    const photos = await this.media.attach(postId, content.photos, author.id);
    if (!content.body && !photos.length) throw new BadRequestException('사진을 다시 올려 주세요.');
    await this.media.prune(postId, photos);
    return photos;
  }

  async create(input: PostInput, author: Identity) {
    const content = this.content(input);
    const video = await this.media.videoFor(content.body);
    const post = await this.posts.create({ ...content, photos: [], video, authorId: author.id, authorName: author.name });
    try {
      const photos = await this.photosFor(post.id, content, author);
      if (photos.length) await this.posts.update(post.id, { ...content, photos, video });
    } catch (error) {
      await this.posts.delete(post.id);
      await this.media.removeForPost(post.id);
      throw error;
    }
    return this.get(post.id, author);
  }

  async edit(id: string, input: PostInput, author: Identity) {
    const post = await this.find(id);
    if (!isAuthor(post, author.id)) throw new ForbiddenException('내 글만 수정할 수 있습니다.');
    const content = this.content(input);
    const photos = await this.photosFor(post.id, content, author);
    await this.posts.update(post.id, { ...content, photos, video: await this.media.videoFor(content.body) });
    return this.get(post.id, author);
  }

  /** authorId 가 없으면 관리 삭제 (content:moderate). 답글, 사진, 좋아요, 신고까지 같이 지움 */
  async remove(id: string, authorId?: string): Promise<void> {
    const post = await this.find(id);
    if (authorId && !isAuthor(post, authorId)) throw new ForbiddenException('내 글만 삭제할 수 있습니다.');
    const commentIds = await this.comments.idsForPost(post.id);
    await this.posts.delete(post.id);
    await this.comments.deleteForPost(post.id);
    await this.media.removeForPost(post.id);
    await Promise.all([
      this.reports.deleteFor('post', [post.id]),
      this.reports.deleteFor('comment', commentIds),
      this.likes.deleteFor('post', [post.id]),
      this.likes.deleteFor('comment', commentIds),
    ]);
  }

  private commentView(comment: FeedComment, avatar: string | null, liked: boolean) {
    return {
      id: comment.id, postId: comment.postId, body: comment.body, parentId: comment.parentId, replyToName: comment.replyToName,
      video: videoView(comment.video), likeCount: comment.likeCount, liked,
      authorId: comment.authorId, authorName: comment.authorName, authorAvatarUrl: avatar,
      createdAt: comment.createdAt, updatedAt: comment.updatedAt,
    };
  }

  async listComments(postId: string, viewer: Identity | null, after?: string) {
    const id = requireEntityId(postId, POST_MISSING);
    if (!(await this.posts.exists(id))) throw new NotFoundException(POST_MISSING);
    const results = await this.comments.listForPost(id, after && requireEntityId(after, POST_MISSING), COMMENTS_PER_PAGE + 1);
    const page = results.slice(0, COMMENTS_PER_PAGE);
    const [avatars, liked] = await Promise.all([
      this.avatars(page.map((comment) => comment.authorId)),
      this.liked(viewer, 'comment', page.map((comment) => comment.id)),
    ]);
    return {
      comments: page.map((comment) => this.commentView(comment, avatars.get(comment.authorId) ?? null, liked.has(comment.id))),
      nextCursor: results.length > COMMENTS_PER_PAGE ? page.at(-1)!.id : null,
    };
  }

  // 답글에 단 답글은 그 타래의 첫 답글 아래로 모으고, 누구에게 답했는지 이름을 남김
  async addComment(postId: string, input: { body: string; parentId?: string }, author: Identity) {
    const post = await this.find(postId);
    let thread: { parentId: string | null; replyToName: string | null } = { parentId: null, replyToName: null };
    if (input.parentId) {
      const parent = await this.findComment(input.parentId);
      if (parent.postId !== post.id) throw new NotFoundException(COMMENT_MISSING);
      thread = { parentId: parent.parentId ?? parent.id, replyToName: parent.authorName };
    }
    const comment = await this.comments.create({
      postId: post.id, authorId: author.id, authorName: author.name, body: input.body, ...thread, video: await this.media.videoFor(input.body),
    });
    await this.posts.addToCommentCount(post.id, 1);
    return this.commentView(comment, author.avatarUrl, false);
  }

  private async findComment(id: string): Promise<FeedComment> {
    const comment = await this.comments.findById(requireEntityId(id, COMMENT_MISSING));
    if (!comment) throw new NotFoundException(COMMENT_MISSING);
    return comment;
  }

  async editComment(id: string, input: { body: string }, author: Identity) {
    const comment = await this.findComment(id);
    if (!isAuthor(comment, author.id)) throw new ForbiddenException('내 답글만 수정할 수 있습니다.');
    const saved = await this.comments.updateBody(comment.id, input.body, await this.media.videoFor(input.body));
    return { id: saved.id, body: saved.body, video: videoView(saved.video), updatedAt: saved.updatedAt };
  }

  /** 타래의 첫 답글을 지우면 그 아래 답글도 같이 지움 */
  async removeComment(id: string, authorId?: string): Promise<void> {
    const comment = await this.findComment(id);
    if (authorId && !isAuthor(comment, authorId)) throw new ForbiddenException('내 답글만 삭제할 수 있습니다.');
    const ids = [comment.id, ...(comment.parentId ? [] : await this.comments.idsForParent(comment.id))];
    await this.comments.deleteMany(ids);
    await this.posts.addToCommentCount(comment.postId, -ids.length);
    await Promise.all([this.reports.deleteFor('comment', ids), this.likes.deleteFor('comment', ids)]);
  }

  /** 좋아요를 누르거나 거둠. 이미 그 상태면 숫자를 바꾸지 않음 */
  async like(targetType: LikeTarget, id: string, on: boolean, viewer: Identity) {
    const target = targetType === 'post' ? await this.find(id) : await this.findComment(id);
    const changed = on ? await this.likes.add(viewer.id, targetType, target.id) : await this.likes.remove(viewer.id, targetType, target.id);
    const delta = changed ? (on ? 1 : -1) : 0;
    if (delta) await (targetType === 'post' ? this.posts : this.comments).addToLikeCount(target.id, delta);
    return { likeCount: Math.max(0, target.likeCount + delta), liked: on };
  }
}
