import { readStore, writeStore } from '@shared/lib';
import type { BlogPostInput } from './types';

// 새 글 쓰는 중에 창을 닫아도 다시 열면 이어 쓰도록 이 브라우저에만 남김. 피드 임시 글과 따로 둠
const DRAFT_KEY = 'blog-post-draft';

export const readBlogDraft = () => readStore<Partial<BlogPostInput>>(DRAFT_KEY);
export const saveBlogDraft = (draft: BlogPostInput) => writeStore(DRAFT_KEY, draft);
export const clearBlogDraft = () => writeStore(DRAFT_KEY, null);
