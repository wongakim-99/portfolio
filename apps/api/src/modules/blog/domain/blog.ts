import { plainText } from './blog-image.js';

// 블로그 영역: 주인장만 쓰는 글. 글마다 공개 범위를 고르고, 잠긴 글은 열람 요청을 허락받아야 읽음

// public 은 누구나, approved 는 주인장이 허락한 회원만, private 은 주인장만 읽음
export const VISIBILITIES = ['public', 'approved', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export interface BlogPost {
  id: string;
  authorId: string;
  title: string;
  body: string;
  visibility: Visibility;
  tags: string[];
  /** 글쓴이가 고른 표지 사진 파일. 없으면 본문 첫 사진을 썸네일로 씀 */
  cover: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AccessRequestStatus = 'pending' | 'rejected';

/** 회원 한 사람이 글 한 편에 남기는 열람 요청. 거절돼도 지우지 않고 남겨서 다시 보낼 수 있는 때를 셈 */
export interface AccessRequest {
  id: string;
  userId: string;
  postId: string;
  message: string;
  status: AccessRequestStatus;
  decidedAt: Date | null;
  createdAt: Date;
}

/** 열람 허락. postId 가 null 이면 approved 글 전부 (앞으로 쓸 글 포함) */
export interface Grant {
  id: string;
  userId: string;
  postId: string | null;
  createdAt: Date;
}

/** 글을 읽으려는 사람. 주인장(blog:write)은 나만 보기 글까지 모두 읽음 */
export type Reader = { id: string; owner: boolean } | null;

/** 이 사람이 받은 허락. all 이면 approved 글 전부 */
export interface ReaderGrants {
  all: boolean;
  posts: Set<string>;
}

export const NO_GRANTS: ReaderGrants = { all: false, posts: new Set() };
export const POSTS_PER_PAGE = 10;
export const EXCERPT_LENGTH = 220;
export const TAG_MAX = 8;
/** 거절된 요청을 다시 보낼 수 있을 때까지 */
export const RETRY_AFTER_MS = 3 * 24 * 60 * 60_000;
// 읽는 시간은 한글 기준 1분에 500자쯤으로 셈
const CHARS_PER_MINUTE = 500;

export function grantsFrom(grants: Pick<Grant, 'postId'>[]): ReaderGrants {
  return {
    all: grants.some((grant) => grant.postId === null),
    posts: new Set(grants.flatMap((grant) => (grant.postId ? [grant.postId] : []))),
  };
}

export function canRead(post: Pick<BlogPost, 'id' | 'visibility'>, reader: Reader, grants: ReaderGrants): boolean {
  if (post.visibility === 'public' || reader?.owner) return true;
  if (post.visibility === 'private') return false;
  return grants.all || grants.posts.has(post.id);
}

/** 나만 보기 글은 주인장이 아니면 목록에도 없고 주소로 열어도 없는 글 */
export const isVisible = (post: Pick<BlogPost, 'visibility'>, reader: Reader) => post.visibility !== 'private' || Boolean(reader?.owner);

/** 마크다운 기호와 사진을 뺀 글자 수로 셈 */
export const readMinutes = (body: string) => Math.max(1, Math.round(plainText(body).length / CHARS_PER_MINUTE));

/** 거절된 요청을 다시 보낼 수 있는 때. 기다리는 요청이면 null */
export const retryAt = (request: Pick<AccessRequest, 'status' | 'decidedAt'>) =>
  request.status === 'rejected' && request.decidedAt ? new Date(request.decidedAt.getTime() + RETRY_AFTER_MS) : null;

// 앞의 # 과 양끝 공백을 떼고, 빈 것과 (대소문자만 다른 것까지) 겹치는 것은 하나만 남김
export function normalizeTags(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  return values
    .map((tag) => (typeof tag === 'string' ? tag.replace(/^#+/, '').trim().replace(/\s+/g, ' ') : tag))
    .filter((tag) => {
      if (typeof tag !== 'string') return true;
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
