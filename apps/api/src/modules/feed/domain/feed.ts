// 피드 영역: 회원이 쓰는 글과 답글, 좋아요, 신고. 글과 답글에는 쓸 때의 이름을 같이 적어 둠 (이름이 바뀌면 따라 고침)
// 쓰레드처럼 제목 없이 바로 쓰는 짧은 글. 제목 있는 긴 글은 예전에 쓴 글만 남아 있고 새로 쓰는 화면은 없음

/** 글과 답글 속 첫 유튜브 링크. 제목과 채널은 글을 저장할 때 유튜브에서 받아 적어 둠 (못 받으면 null) */
export interface FeedVideo {
  id: string;
  title: string | null;
  author: string | null;
}

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  /** 짧은 글은 빈 글자 */
  title: string;
  body: string;
  /** 피드 사진 파일 이름 (community_images 의 file) */
  photos: string[];
  /** 본문과 따로 붙인 링크 하나 (http, https) */
  link: string | null;
  video: FeedVideo | null;
  commentCount: number;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  /** 답글에 단 답글이면 그 타래의 첫 답글. 글에 바로 단 답글은 null (타래는 한 단계만 들여 씀) */
  parentId: string | null;
  /** 누구의 답글에 답했는지. 화면에 '@이름' 으로 보임 */
  replyToName: string | null;
  video: FeedVideo | null;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const REPORT_TARGETS = ['post', 'comment'] as const;
export const REPORT_REASONS = ['spam', 'abuse', 'other'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];

/** 좋아요는 글과 답글에 누름 */
export const LIKE_TARGETS = REPORT_TARGETS;
export type LikeTarget = ReportTarget;

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
/** 짧은 글 길이. 쓰레드처럼 한 번에 읽히는 만큼 */
export const SHORT_POST_MAX = 500;
/** 긴 글(제목 있는 글)의 본문 최소 길이. 예전 피드 규칙 그대로 */
export const LONG_POST_MIN = 20;
export const POST_PHOTOS_MAX = 4;

// 내 글과 답글만 고치고 지움. 관리자도 남의 글 내용은 고칠 수 없고 삭제만 할 수 있음 (역할이 아니라 글쓴이로 따짐)
export const isAuthor = (item: { authorId: string }, userId: string) => item.authorId === userId;

/** 제목, 본문, 사진, 링크가 글 규칙에 맞는지. 어긋나면 그 까닭을 돌려줌 */
export function postProblem({ title, body, photos, link }: { title: string; body: string; photos: string[]; link: string | null }): string | null {
  if (photos.length > POST_PHOTOS_MAX) return `사진은 ${POST_PHOTOS_MAX}장까지 붙일 수 있습니다.`;
  // 예전 긴 글을 고칠 때만 제목이 옴
  if (title) return body.length < LONG_POST_MIN ? `제목을 붙인 긴 글은 본문을 ${LONG_POST_MIN}자 이상 써 주세요.` : null;
  if (!body && !photos.length && !link) return '글, 사진, 링크 가운데 하나는 넣어 주세요.';
  return body.length > SHORT_POST_MAX ? `글은 ${SHORT_POST_MAX}자까지 씁니다.` : null;
}

/** 붙인 링크를 화면에 보일 모양. 사이트 이름(앞의 www. 는 뺌)과 주소 */
export function linkView(url: string | null): { url: string; host: string } | null {
  if (!url) return null;
  try {
    return { url, host: new URL(url).host.replace(/^www\./, '') };
  } catch {
    return null;
  }
}

// 유튜브 영상 주소: watch?v=, youtu.be/, shorts/, live/, embed/. 영상 ID 는 11자
const YOUTUBE = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})(?![\w-])/;
export const YOUTUBE_ID = /^[\w-]{11}$/;

/** 글 속 첫 유튜브 영상 ID. 없으면 null */
export function youtubeIdIn(text: string): string | null {
  return YOUTUBE.exec(text)?.[1] ?? null;
}
