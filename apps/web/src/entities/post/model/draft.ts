import { readStore, writeStore } from '@shared/lib';

// 새 글 쓰는 중에 창을 닫아도 다시 열면 이어 쓰도록 이 브라우저에만 남김. 수정할 때는 남기지 않음
const DRAFT_KEY = 'community-post-draft';

export interface PostDraft {
  title: string;
  body: string;
}

export const readDraft = () => readStore<Partial<PostDraft>>(DRAFT_KEY);
export const saveDraft = (draft: PostDraft) => writeStore(DRAFT_KEY, draft);
export const clearDraft = () => writeStore(DRAFT_KEY, null);
