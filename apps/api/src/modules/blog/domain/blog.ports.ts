import type { AccessRequest, BlogPost, Grant, Visibility } from './blog.js';
import type { ProofSubmission } from './proof.js';

export interface BlogListFilter {
  /** 주인장이면 나만 보기 글까지 */
  includePrivate: boolean;
  before?: string;
  tag?: string;
  visibility?: Visibility;
  /** 제목과 태그는 늘 찾고, 본문은 bodyScope 가 all 이면 모든 글, public 이면 누구나 읽는 글에서만 찾음 */
  search?: { text: string; bodyScope: 'all' | 'public' };
}

export interface BlogCounts {
  byVisibility: Partial<Record<Visibility, number>>;
  tags: { name: string; count: number }[];
}

export abstract class BlogPostRepository {
  abstract list(filter: BlogListFilter, limit: number): Promise<BlogPost[]>;
  /** 공개 범위별 글 수와 많이 쓴 태그 */
  abstract counts(includePrivate: boolean, tagLimit: number): Promise<BlogCounts>;
  abstract findById(id: string): Promise<BlogPost | null>;
  abstract findMany(ids: string[]): Promise<BlogPost[]>;
  abstract create(input: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<BlogPost>;
  abstract update(id: string, input: Pick<BlogPost, 'title' | 'body' | 'visibility' | 'tags' | 'cover'>): Promise<void>;
  abstract delete(id: string): Promise<boolean>;
}

export abstract class AccessRequestRepository {
  abstract find(userId: string, postId: string): Promise<AccessRequest | null>;
  /** 같은 사람이 같은 글에 이미 요청이 있으면 false */
  abstract create(input: { userId: string; postId: string; message: string }): Promise<boolean>;
  abstract delete(id: string): Promise<void>;
  abstract deleteForPost(postId: string): Promise<void>;
  abstract deleteForUser(userId: string): Promise<void>;
  abstract pending(limit: number): Promise<AccessRequest[]>;
  abstract findPending(id: string): Promise<AccessRequest | null>;
  /** 기다리던 요청이면 거절로 바꾸고 true */
  abstract reject(id: string, at: Date): Promise<boolean>;
}

export abstract class GrantRepository {
  abstract forUser(userId: string): Promise<Grant[]>;
  /** 이미 있으면 그대로 둠 */
  abstract grant(userId: string, postId: string | null): Promise<void>;
  abstract deleteForPost(postId: string): Promise<void>;
  abstract latest(limit: number): Promise<Grant[]>;
  abstract delete(id: string): Promise<boolean>;
}

// 열람 요청이 오면 주인장에게, 허락하면 요청한 사람에게 알림. 못 보내도 요청과 허락은 그대로 남음
export abstract class BlogNotifier {
  abstract requestReceived(requesterName: string, postTitle: string): void;
  abstract granted(userId: string, grantedPostTitle: string | null, requestedPostId: string): void;
  /** 증명 채점의 오늘 AI 한도를 다 썼을 때 주인장에게 한 번 알림 */
  abstract proofLimitReached(limit: number): void;
}

// 올린 블로그 사진의 기록. 어느 글에 붙었는지 적어 두고, 글에서 빠지거나 글이 지워지면 사진 저장소에서도 지움
export abstract class BlogImageRepository {
  abstract create(input: { file: string; size: number }): Promise<void>;
  /** 아직 아무 글에도 붙지 않았거나 이 글에 붙은 사진만 이 글에 붙임 */
  abstract attach(files: string[], postId: string): Promise<void>;
  abstract filesForPost(postId: string): Promise<string[]>;
  /** 글에 붙지 않은 채 before 보다 먼저 올린 사진 */
  abstract orphans(before: Date): Promise<string[]>;
  abstract delete(files: string[]): Promise<void>;
}

// 잠긴 글의 증명을 읽고 빨간 펜 채점평을 한 조각씩 흘려보냄. 채점기를 못 쓰면(키 없음, 바깥 오류) null
// 채점기는 글 내용을 모르고, 무엇을 돌려주든 글이 열리지 않음
export abstract class ProofGrader {
  abstract grade(submission: ProofSubmission, signal: AbortSignal): Promise<AsyncIterable<string> | null>;
}

// 증명 채점에서 바깥 AI 를 부른 횟수. 날마다 방문자별, 사이트 전체로 세고 DB 에 남겨 배포해도 이어서 셈
export abstract class ProofUsageRepository {
  /** 두 한도 안이면 한 번 쓰고 오늘 사이트 전체 횟수를, 하나라도 넘었으면 null */
  abstract take(day: string, visitor: string, limits: { total: number; perVisitor: number }): Promise<number | null>;
  abstract total(day: string): Promise<number>;
}
