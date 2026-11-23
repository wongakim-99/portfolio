import type { FeedComment, FeedPost, FeedVideo, LikeTarget, Report, ReportReason, ReportTarget } from './feed.js';

type PostContent = { title: string; body: string; photos: string[]; link: string | null; video: FeedVideo | null };

export abstract class PostRepository {
  /** 최근 글부터. before 는 이 글보다 오래된 것만, authorId 는 그 회원의 글만 */
  abstract list(options: { before?: string; authorId?: string }, limit: number): Promise<FeedPost[]>;
  abstract findById(id: string): Promise<FeedPost | null>;
  abstract findMany(ids: string[]): Promise<FeedPost[]>;
  abstract exists(id: string): Promise<boolean>;
  abstract create(input: PostContent & { authorId: string; authorName: string }): Promise<FeedPost>;
  abstract update(id: string, input: PostContent): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract addToCommentCount(id: string, delta: number): Promise<void>;
  abstract addToLikeCount(id: string, delta: number): Promise<void>;
  abstract countByAuthor(authorId: string): Promise<number>;
  /** 글쓴이 이름만 바꿈. 글의 수정 시각은 그대로 둠 */
  abstract renameAuthor(authorId: string, name: string): Promise<void>;
}

export abstract class CommentRepository {
  /** 오래된 답글부터. after 는 이 답글보다 새 것만 */
  abstract listForPost(postId: string, after: string | undefined, limit: number): Promise<FeedComment[]>;
  abstract findById(id: string): Promise<FeedComment | null>;
  abstract findMany(ids: string[]): Promise<FeedComment[]>;
  abstract exists(id: string): Promise<boolean>;
  abstract create(input: {
    postId: string; authorId: string; authorName: string; body: string; parentId: string | null; replyToName: string | null; video: FeedVideo | null;
  }): Promise<FeedComment>;
  abstract updateBody(id: string, body: string, video: FeedVideo | null): Promise<FeedComment>;
  abstract delete(id: string): Promise<void>;
  abstract idsForPost(postId: string): Promise<string[]>;
  /** 이 답글 타래에 달린 답글들 */
  abstract idsForParent(parentId: string): Promise<string[]>;
  abstract deleteMany(ids: string[]): Promise<void>;
  abstract deleteForPost(postId: string): Promise<void>;
  abstract addToLikeCount(id: string, delta: number): Promise<void>;
  abstract countByAuthor(authorId: string): Promise<number>;
  abstract renameAuthor(authorId: string, name: string): Promise<void>;
}

export abstract class LikeRepository {
  /** 새로 눌렀으면 true, 이미 눌러 둔 것이면 false */
  abstract add(userId: string, targetType: LikeTarget, targetId: string): Promise<boolean>;
  /** 눌러 둔 것을 거뒀으면 true */
  abstract remove(userId: string, targetType: LikeTarget, targetId: string): Promise<boolean>;
  /** ids 가운데 이 사람이 좋아요를 누른 것 */
  abstract likedBy(userId: string, targetType: LikeTarget, ids: string[]): Promise<Set<string>>;
  abstract deleteFor(targetType: LikeTarget, ids: string[]): Promise<void>;
}

export abstract class ReportRepository {
  /** 같은 사람이 같은 것을 두 번 신고하면 false */
  abstract create(input: { reporterId: string; targetType: ReportTarget; targetId: string; reason: ReportReason }): Promise<boolean>;
  abstract latest(limit: number): Promise<Report[]>;
  abstract count(): Promise<number>;
  abstract delete(id: string): Promise<boolean>;
  abstract deleteFor(targetType: ReportTarget, targetIds: string[]): Promise<void>;
}

export abstract class FeedImageRepository {
  abstract create(input: { file: string; size: number; ownerId: string }): Promise<void>;
  /** 이 사람이 올린 사진 가운데 아직 글에 붙지 않았거나 이 글에 붙은 것만 붙이고, 붙인 파일을 돌려줌 */
  abstract attach(files: string[], postId: string, ownerId: string): Promise<string[]>;
  abstract filesForPost(postId: string): Promise<string[]>;
  /** 글에 붙지 않은 채 before 보다 먼저 올린 사진 */
  abstract orphans(before: Date): Promise<string[]>;
  abstract delete(files: string[]): Promise<void>;
}

/** 유튜브에서 읽어 둔 영상 제목과 채널. 같은 영상을 다시 묻지 않음 */
export abstract class VideoCache {
  abstract find(id: string): Promise<{ title: string | null; author: string | null } | null>;
  abstract save(id: string, meta: { title: string | null; author: string | null }): Promise<void>;
}

/** 바깥 유튜브. 영상 제목, 채널(oEmbed)과 썸네일을 읽음. 없는 영상이거나 못 읽으면 null */
export abstract class VideoSource {
  abstract meta(id: string): Promise<{ title: string; author: string } | null>;
  abstract thumbnail(id: string): Promise<Buffer | null>;
}
