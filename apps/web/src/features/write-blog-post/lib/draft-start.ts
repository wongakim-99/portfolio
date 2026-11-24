import type { BlogDraft, BlogPost, BlogPostInput } from '@entities/blog-post';

// 실수로 넋두리를 공개하는 쪽이 기술 글을 잠그는 쪽보다 곤란하므로 새 글은 '허락한 사람만'으로 시작함
export const EMPTY: BlogPostInput = { title: '', body: '', visibility: 'approved', tags: [], cover: null, roomId: null };

/** 글쓰기 칸에 든 내용을 한 줄로. 같은 글인지, 저장할 게 남았는지 견줄 때 씀 */
export const contentKey = ({ title, body, visibility, tags, cover, roomId }: BlogPostInput) =>
  JSON.stringify([title, body, visibility, tags, cover, roomId]);

const contentOf = ({ title, body, visibility, tags, cover, roomId }: BlogPostInput): BlogPostInput => ({ title, body, visibility, tags, cover, roomId });

const isBlank = (draft: BlogPostInput) => !draft.title.trim() && !draft.body.trim() && !draft.tags.length && !draft.cover;

export interface DraftStart {
  /** 올린 글 그대로(고치기) 또는 빈 글(새 글). 임시 글을 버리면 여기로 돌아감 */
  base: BlogPostInput;
  /** 이어 쓸 임시 글. 없으면 null */
  restored: { content: BlogPostInput; savedAt: string } | null;
  /** 서버에 이미 있는 내용. 글쓰기 칸이 이것과 다르면 서버에 남김. 이어 쓸 게 없으면 처음 내용(base)이라 열기만 해서는 남기지 않음 */
  synced: BlogPostInput;
}

/**
 * 서버 임시 글과 이 브라우저 임시 글 가운데 늦게 남긴 쪽으로 이어 씀
 * 고치는 글은 그 글을 마지막으로 올린 뒤에 남긴 것만 보고, 비었거나 올린 글과 같은 임시 글은 없는 것으로 봄
 */
export function draftStart(post: BlogPost | null, server: BlogDraft | null, local: BlogDraft | null): DraftStart {
  const base = post ? { title: post.title, body: post.body ?? '', visibility: post.visibility, tags: post.tags, cover: post.coverFile, roomId: post.room?.id ?? null } : EMPTY;
  const baseKey = contentKey(base);
  const newest = [server, local]
    .filter((draft): draft is BlogDraft => draft !== null && (!post || draft.savedAt > post.updatedAt))
    .filter((draft) => !isBlank(draft) && contentKey(draft) !== baseKey)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
  if (!newest) return { base, restored: null, synced: base };
  return { base, restored: { content: contentOf(newest), savedAt: newest.savedAt }, synced: server ? contentOf(server) : base };
}
