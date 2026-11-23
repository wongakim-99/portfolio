import type { LinkPreview, YoutubeVideo } from '@shared/ui';

// apps/api/src/modules/feed/application/posts.service.ts 의 응답 모양

export interface PostPhoto {
  file: string;
  url: string;
}

export interface PostSummary {
  id: string;
  /** 예전에 쓴 긴 글만 제목이 있음. 지금 쓰는 글은 빈 글자 */
  title: string;
  /** 짧은 글은 본문 전부, 제목 있는 긴 글은 앞 220자 */
  excerpt: string;
  /** 긴 글 본문이 잘렸으면 true */
  truncated: boolean;
  photos: PostPhoto[];
  /** 본문과 따로 붙인 링크 */
  link: LinkPreview | null;
  /** 붙인 링크(없으면 본문 첫 유튜브 링크)의 영상 */
  video: YoutubeVideo | null;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  commentCount: number;
  likeCount: number;
  /** 보는 사람이 좋아요를 눌렀는지. 로그인 전이면 false */
  liked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Post extends Omit<PostSummary, 'excerpt' | 'truncated'> {
  body: string;
}

export interface PostPage {
  posts: PostSummary[];
  nextCursor: string | null;
}

/** 글 쓰기, 고치기에서 보내는 것. 제목은 예전 긴 글을 고칠 때만 보냄 */
export interface PostInput {
  title?: string;
  body: string;
  /** 사진 파일 이름 */
  photos?: string[];
  /** 따로 붙인 링크. 비우면 링크 없음 */
  link?: string;
}

/** 글 길이 제한. API DTO, domain 과 같은 값. 글은 500자, 사진 4장, 링크 하나. 예전 긴 글은 제목 5자 이상, 본문 20자 이상 */
export const POST_LIMITS = { titleMin: 5, titleMax: 120, bodyMin: 20, bodyMax: 20_000, shortMax: 500, photosMax: 4, linkMax: 500 } as const;
