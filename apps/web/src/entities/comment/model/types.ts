import type { YoutubeVideo } from '@shared/ui';

// apps/api/src/modules/feed/application/posts.service.ts 의 답글 응답 모양

export interface Comment {
  id: string;
  postId: string;
  body: string;
  /** 답글에 단 답글이면 그 타래의 첫 답글. 글에 바로 단 답글은 null */
  parentId: string | null;
  /** 누구의 답글에 답했는지 */
  replyToName: string | null;
  video: YoutubeVideo | null;
  likeCount: number;
  liked: boolean;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
}

export interface CommentPage {
  comments: Comment[];
  nextCursor: string | null;
}

/** 답글 길이 제한. API DTO 와 같은 값 */
export const COMMENT_LIMITS = { min: 1, max: 2000 } as const;
