// apps/api/src/modules/blog/application/blog-posts.service.ts 의 응답 모양

/** public 은 누구나, approved 는 주인장이 허락한 회원만, private 은 주인장만 읽음 */
export type Visibility = 'public' | 'approved' | 'private';

export interface BlogPostSummary {
  id: string;
  title: string;
  visibility: Visibility;
  /** 지금 보는 사람이 본문을 못 읽으면 true. 제목과 태그만 보임 */
  locked: boolean;
  tags: string[];
  /** 본문 앞 220자. 잠긴 글이면 null */
  excerpt: string | null;
  /** 읽는 데 걸리는 분. 잠긴 글이면 null */
  readMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 잠긴 글에 내가 보낸 열람 요청. 거절되면 retryAt 이후에 다시 보낼 수 있음 */
export interface AccessRequestState {
  status: 'pending' | 'rejected';
  createdAt: string;
  retryAt: string | null;
}

export interface BlogPost extends Omit<BlogPostSummary, 'excerpt'> {
  /** 잠긴 글이면 null */
  body: string | null;
  /** 잠긴 글을 로그인한 회원이 볼 때만. 아직 요청하지 않았으면 null */
  request: AccessRequestState | null;
}

export interface BlogPostPage {
  posts: BlogPostSummary[];
  nextCursor: string | null;
}

export interface BlogPostInput {
  title: string;
  body: string;
  visibility: Visibility;
  tags: string[];
}

/** 목록 거르기. 블로그 주소의 ?tag=, ?q=, ?visibility= 와 같음 */
export interface BlogListQuery {
  tag?: string | null;
  q?: string | null;
  visibility?: Visibility | null;
}

/** 목록 옆 사이드바. private 은 주인장에게만 숫자가 옴 */
export interface BlogSummary {
  total: number;
  public: number;
  approved: number;
  private: number | null;
  tags: { name: string; count: number }[];
  owner: { id: string; name: string; bio: string; avatarUrl: string | null } | null;
}

/** 글 길이 제한. API DTO(apps/api/src/modules/blog/presentation/blog.dto.ts)와 같은 값 */
export const BLOG_LIMITS = { titleMin: 2, titleMax: 120, bodyMin: 1, bodyMax: 50_000, requestMax: 300, tagMax: 8, tagLength: 20 } as const;

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: '전체 공개',
  approved: '허락한 사람만',
  private: '나만 보기',
};
