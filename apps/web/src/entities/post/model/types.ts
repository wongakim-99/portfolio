import type { YoutubeVideo } from '@shared/ui';

// apps/api/src/modules/feed/application/posts.service.ts 의 응답 모양

export interface PostPhoto {
  file: string;
  url: string;
}

export interface PostSummary {
  id: string;
  /** 짧은 글은 빈 글자 */
  title: string;
  /** 짧은 글은 본문 전부, 제목 있는 긴 글은 앞 220자 */
  excerpt: string;
  /** 긴 글 본문이 잘렸으면 true */
  truncated: boolean;
  photos: PostPhoto[];
  /** 본문 첫 유튜브 링크 */
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

/** 글 쓰기, 고치기에서 보내는 것. 제목이 비면 짧은 글 */
export interface PostInput {
  title?: string;
  body: string;
  /** 사진 파일 이름 */
  photos?: string[];
}

/** 글 길이 제한. API DTO, domain 과 같은 값. 짧은 글은 500자와 사진 4장, 제목 있는 긴 글은 본문 20자 이상 */
export const POST_LIMITS = { titleMin: 5, titleMax: 120, bodyMin: 20, bodyMax: 20_000, shortMax: 500, photosMax: 4 } as const;
