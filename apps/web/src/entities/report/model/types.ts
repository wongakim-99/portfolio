export type ReportReason = 'spam' | 'abuse' | 'other';
export type ReportTargetType = 'post' | 'comment';

export const REPORT_REASONS: Record<ReportReason, string> = {
  spam: '광고 / 스팸',
  abuse: '모욕 / 괴롭힘',
  other: '기타',
};

export interface ReportTarget {
  targetType: ReportTargetType;
  targetId: string;
}

export interface Report extends ReportTarget {
  id: string;
  reason: ReportReason;
  createdAt: string;
  /** 신고된 글이나 댓글. 이미 지워졌으면 null */
  target: { postId: string; authorName: string; text: string } | null;
}
