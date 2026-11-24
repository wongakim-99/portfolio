import { readStore, writeStore } from '@shared/lib';
import type { BlogDraft, BlogPostInput } from './types';

// 서버에 아직 못 남긴 임시 글을 이 브라우저에만 둠. 서버가 잠깐 안 될 때 창을 닫아도 이어 쓰게 함. 피드 임시 글과 따로 둠
// 새 글은 예전부터 쓰던 키를 그대로 쓰고, 고치는 글은 글마다 따로 둠
const draftKey = (postId?: string) => (postId ? `blog-post-draft:${postId}` : 'blog-post-draft');

/** 예전에 남긴 임시 글에는 savedAt 이 없어서 가장 오래된 것으로 봄 */
export function readLocalDraft(postId?: string): BlogDraft | null {
  const saved = readStore<Partial<BlogDraft>>(draftKey(postId));
  if (!saved || typeof saved !== 'object') return null;
  return {
    title: saved.title ?? '',
    body: saved.body ?? '',
    visibility: saved.visibility ?? 'approved',
    tags: saved.tags ?? [],
    cover: saved.cover ?? null,
    roomId: saved.roomId ?? null,
    savedAt: saved.savedAt ?? new Date(0).toISOString(),
  };
}

export const saveLocalDraft = (postId: string | undefined, draft: BlogPostInput) =>
  writeStore(draftKey(postId), { ...draft, savedAt: new Date().toISOString() });
export const clearLocalDraft = (postId?: string) => writeStore(draftKey(postId), null);
