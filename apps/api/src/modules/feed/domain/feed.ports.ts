import type { FeedComment, FeedPost, Report, ReportReason, ReportTarget } from './feed.js';

export abstract class PostRepository {
  /** 최근 글부터. before 는 이 글보다 오래된 것만, authorId 는 그 회원의 글만 */
  abstract list(options: { before?: string; authorId?: string }, limit: number): Promise<FeedPost[]>;
  abstract findById(id: string): Promise<FeedPost | null>;
  abstract findMany(ids: string[]): Promise<FeedPost[]>;
  abstract exists(id: string): Promise<boolean>;
  abstract create(input: { authorId: string; authorName: string; title: string; body: string }): Promise<FeedPost>;
  abstract update(id: string, input: { title: string; body: string }): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract addToCommentCount(id: string, delta: number): Promise<void>;
  abstract countByAuthor(authorId: string): Promise<number>;
  /** 글쓴이 이름만 바꿈. 글의 수정 시각은 그대로 둠 */
  abstract renameAuthor(authorId: string, name: string): Promise<void>;
}

export abstract class CommentRepository {
  /** 오래된 댓글부터. after 는 이 댓글보다 새 것만 */
  abstract listForPost(postId: string, after: string | undefined, limit: number): Promise<FeedComment[]>;
  abstract findById(id: string): Promise<FeedComment | null>;
  abstract findMany(ids: string[]): Promise<FeedComment[]>;
  abstract exists(id: string): Promise<boolean>;
  abstract create(input: { postId: string; authorId: string; authorName: string; body: string }): Promise<FeedComment>;
  abstract updateBody(id: string, body: string): Promise<FeedComment>;
  abstract delete(id: string): Promise<void>;
  abstract idsForPost(postId: string): Promise<string[]>;
  abstract deleteForPost(postId: string): Promise<void>;
  abstract countByAuthor(authorId: string): Promise<number>;
  abstract renameAuthor(authorId: string, name: string): Promise<void>;
}

export abstract class ReportRepository {
  /** 같은 사람이 같은 것을 두 번 신고하면 false */
  abstract create(input: { reporterId: string; targetType: ReportTarget; targetId: string; reason: ReportReason }): Promise<boolean>;
  abstract latest(limit: number): Promise<Report[]>;
  abstract count(): Promise<number>;
  abstract delete(id: string): Promise<boolean>;
  abstract deleteFor(targetType: ReportTarget, targetIds: string[]): Promise<void>;
}
