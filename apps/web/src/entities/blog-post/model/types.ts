// apps/api/src/modules/blog/application/blog-posts.service.ts 의 응답 모양

/** public 은 누구나, approved 는 주인장이 허락한 회원만, private 은 주인장만 읽음 */
export type Visibility = 'public' | 'approved' | 'private';

/** 글이 든 방의 이름표 */
export interface BlogRoomRef {
  id: string;
  name: string;
}

/** 방과 그 방에 든 글 수 */
export interface BlogRoom extends BlogRoomRef {
  count: number;
}

export interface BlogPostSummary {
  id: string;
  title: string;
  visibility: Visibility;
  /** 지금 보는 사람이 본문을 못 읽으면 true. 제목과 태그만 보임 */
  locked: boolean;
  tags: string[];
  /** 썸네일 주소. 고른 표지가 없으면 본문 첫 사진. 잠긴 글은 고른 표지만 */
  cover: string | null;
  /** 글이 든 방. 아직 방이 없으면 null */
  room: BlogRoomRef | null;
  /** 본문 앞 220자 (마크다운 기호를 뺀 글자). 잠긴 글이면 null */
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
  /** 마크다운 본문. 잠긴 글이면 null */
  body: string | null;
  /** 글쓴이가 고른 표지 사진 파일. 고르지 않았으면 null */
  coverFile: string | null;
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
  /** 표지 사진 파일. null 이면 본문 첫 사진을 썸네일로 씀 */
  cover: string | null;
  /** 글이 들 방. null 이면 방 밖 */
  roomId: string | null;
}

/** 쓰다 만 글. 서버(GET /drafts/:key)나 이 브라우저에 남김. savedAt 은 마지막으로 남긴 때 */
export interface BlogDraft extends BlogPostInput {
  savedAt: string;
}

/** 관리실의 방 목록 (나만 보기 글까지 센 글 수)과 아직 방이 없는 글 수 */
export interface RoomOverview {
  rooms: BlogRoom[];
  unsorted: number;
}

/** AI 가 방 없는 글에 고른 방. 저장 전이라 주인장이 확인하고 고침 */
export interface RoomSuggestion {
  post: { id: string; title: string; visibility: Visibility };
  roomId: string | null;
}

/** 블로그에 올린 사진 한 장 */
export interface BlogImage {
  file: string;
  url: string;
  width: number;
  height: number;
}

/** 목록 거르기. 블로그 주소의 ?room=, ?tag=, ?q=, ?visibility= 와 같음. room 이 NO_ROOM 이면 방 없는 글 */
export interface BlogListQuery {
  room?: string | null;
  tag?: string | null;
  q?: string | null;
  visibility?: Visibility | null;
}

/** 방 없는 글을 고르는 ?room= 값 (API 의 NO_ROOM) */
export const NO_ROOM = 'none';
export const ROOM_NAME_MAX = 20;

/** 목록 옆 사이드바. 방 글 수와 private 은 보는 사람에게 보이는 글만 셈 */
export interface BlogSummary {
  rooms: BlogRoom[];
  /** 아직 방이 없는 글 수 */
  unsorted: number;
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
