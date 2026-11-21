// 피드 영역: 회원이 쓰는 긴 글과 댓글, 신고. 글과 댓글에는 쓸 때의 이름을 같이 적어 둠 (이름이 바뀌면 따라 고침)

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export const REPORT_TARGETS = ['post', 'comment'] as const;
export const REPORT_REASONS = ['spam', 'abuse', 'other'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  createdAt: Date;
}

export const POSTS_PER_PAGE = 10;
export const COMMENTS_PER_PAGE = 40;
export const EXCERPT_LENGTH = 220;

// 내 글과 댓글만 고치고 지움. 관리자도 남의 글 내용은 고칠 수 없고 삭제만 할 수 있음 (역할이 아니라 글쓴이로 따짐)
export const isAuthor = (item: { authorId: string }, userId: string) => item.authorId === userId;
