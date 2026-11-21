export interface Comment {
  id: string;
  postId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
}

export interface CommentPage {
  comments: Comment[];
  nextCursor: string | null;
}

/** 댓글 길이 제한. API DTO 와 같은 값 */
export const COMMENT_LIMITS = { min: 2, max: 2000 } as const;
