// apps/api/src/modules/feed/application/posts.service.ts 의 응답 모양

export interface PostSummary {
  id: string;
  title: string;
  /** 본문 앞 220자 */
  excerpt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Post extends Omit<PostSummary, 'excerpt'> {
  body: string;
}

export interface PostPage {
  posts: PostSummary[];
  nextCursor: string | null;
}

/** 글 길이 제한. API DTO 와 같은 값 */
export const POST_LIMITS = { titleMin: 5, titleMax: 120, bodyMin: 20, bodyMax: 20_000 } as const;
