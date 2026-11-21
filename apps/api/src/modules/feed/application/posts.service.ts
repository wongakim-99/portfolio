import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import { UserDirectory, type Identity } from '../../identity/index.js';
import { COMMENTS_PER_PAGE, EXCERPT_LENGTH, isAuthor, POSTS_PER_PAGE, type FeedComment, type FeedPost } from '../domain/feed.js';
import { CommentRepository, PostRepository, ReportRepository } from '../domain/feed.ports.js';

const POST_MISSING = '글을 찾을 수 없습니다.';

// 피드 글과 댓글. 글쓴이 사진은 글에 적어 두지 않고 지금 설정된 것을 계정 영역에서 찾아 붙임
@Injectable()
export class PostsService {
  constructor(
    private readonly posts: PostRepository,
    private readonly comments: CommentRepository,
    private readonly reports: ReportRepository,
    private readonly directory: UserDirectory,
  ) {}

  private async avatars(authorIds: string[]): Promise<Map<string, string | null>> {
    const people = await this.directory.people(authorIds);
    return new Map([...people].map(([id, person]) => [id, person.avatarUrl]));
  }

  async list(before?: string, author?: string) {
    const results = await this.posts.list({
      before: before && requireEntityId(before, POST_MISSING),
      authorId: author && requireEntityId(author, POST_MISSING),
    }, POSTS_PER_PAGE + 1);
    const page = results.slice(0, POSTS_PER_PAGE);
    const avatars = await this.avatars(page.map((post) => post.authorId));
    return {
      posts: page.map((post) => ({
        id: post.id, title: post.title, excerpt: post.body.slice(0, EXCERPT_LENGTH),
        authorId: post.authorId, authorName: post.authorName, authorAvatarUrl: avatars.get(post.authorId) ?? null,
        commentCount: post.commentCount, createdAt: post.createdAt, updatedAt: post.updatedAt,
      })),
      nextCursor: results.length > POSTS_PER_PAGE ? page.at(-1)!.id : null,
    };
  }

  private async find(id: string): Promise<FeedPost> {
    const post = await this.posts.findById(requireEntityId(id, POST_MISSING));
    if (!post) throw new NotFoundException(POST_MISSING);
    return post;
  }

  async get(id: string) {
    const post = await this.find(id);
    const avatars = await this.avatars([post.authorId]);
    return {
      id: post.id, title: post.title, body: post.body,
      authorId: post.authorId, authorName: post.authorName, authorAvatarUrl: avatars.get(post.authorId) ?? null,
      commentCount: post.commentCount, createdAt: post.createdAt, updatedAt: post.updatedAt,
    };
  }

  async create(input: { title: string; body: string }, author: Identity) {
    const post = await this.posts.create({ title: input.title, body: input.body, authorId: author.id, authorName: author.name });
    return this.get(post.id);
  }

  async edit(id: string, input: { title: string; body: string }, author: Identity) {
    const post = await this.find(id);
    if (!isAuthor(post, author.id)) throw new ForbiddenException('내 글만 수정할 수 있습니다.');
    await this.posts.update(post.id, input);
    return this.get(post.id);
  }

  /** authorId 가 없으면 관리 삭제 (content:moderate). 댓글과 그 신고까지 같이 지움 */
  async remove(id: string, authorId?: string): Promise<void> {
    const post = await this.find(id);
    if (authorId && !isAuthor(post, authorId)) throw new ForbiddenException('내 글만 삭제할 수 있습니다.');
    const commentIds = await this.comments.idsForPost(post.id);
    await this.posts.delete(post.id);
    await this.comments.deleteForPost(post.id);
    await this.reports.deleteFor('post', [post.id]);
    await this.reports.deleteFor('comment', commentIds);
  }

  async listComments(postId: string, after?: string) {
    const id = requireEntityId(postId, POST_MISSING);
    if (!(await this.posts.exists(id))) throw new NotFoundException(POST_MISSING);
    const results = await this.comments.listForPost(id, after && requireEntityId(after, POST_MISSING), COMMENTS_PER_PAGE + 1);
    const page = results.slice(0, COMMENTS_PER_PAGE);
    const avatars = await this.avatars(page.map((comment) => comment.authorId));
    return {
      comments: page.map((comment) => ({
        id: comment.id, postId: comment.postId, body: comment.body,
        authorId: comment.authorId, authorName: comment.authorName, authorAvatarUrl: avatars.get(comment.authorId) ?? null,
        createdAt: comment.createdAt, updatedAt: comment.updatedAt,
      })),
      nextCursor: results.length > COMMENTS_PER_PAGE ? page.at(-1)!.id : null,
    };
  }

  async addComment(postId: string, input: { body: string }, author: Identity) {
    const post = await this.find(postId);
    const comment = await this.comments.create({ postId: post.id, authorId: author.id, authorName: author.name, body: input.body });
    await this.posts.addToCommentCount(post.id, 1);
    return {
      id: comment.id, body: comment.body, authorId: author.id, authorName: author.name,
      authorAvatarUrl: author.avatarUrl, createdAt: comment.createdAt,
    };
  }

  private async findComment(id: string): Promise<FeedComment> {
    const comment = await this.comments.findById(requireEntityId(id, POST_MISSING));
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    return comment;
  }

  async editComment(id: string, input: { body: string }, author: Identity) {
    const comment = await this.findComment(id);
    if (!isAuthor(comment, author.id)) throw new ForbiddenException('내 댓글만 수정할 수 있습니다.');
    const saved = await this.comments.updateBody(comment.id, input.body);
    return { id: saved.id, body: saved.body, updatedAt: saved.updatedAt };
  }

  async removeComment(id: string, authorId?: string): Promise<void> {
    const comment = await this.findComment(id);
    if (authorId && !isAuthor(comment, authorId)) throw new ForbiddenException('내 댓글만 삭제할 수 있습니다.');
    await this.comments.delete(comment.id);
    await this.posts.addToCommentCount(comment.postId, -1);
    await this.reports.deleteFor('comment', [comment.id]);
  }
}
