import { blogRequest } from '@shared/api';
import type { AccessRequestState, BlogListQuery, BlogPost, BlogPostInput, BlogPostPage, BlogSummary } from '../model/types';

/** 최근 글 10개씩. 잠긴 글은 제목과 태그만, 나만 보기 글은 주인장에게만 옴 */
export function listBlogPosts({ before, tag, q, visibility }: BlogListQuery & { before?: string | null } = {}) {
  const query = new URLSearchParams();
  if (tag) query.set('tag', tag);
  if (q) query.set('q', q);
  if (visibility) query.set('visibility', visibility);
  if (before) query.set('before', before);
  return blogRequest<BlogPostPage>(`/posts${query.size ? `?${query}` : ''}`);
}

/** 공개 범위별 글 수, 많이 쓴 태그, 주인장 소개 */
export const getBlogSummary = () => blogRequest<BlogSummary>('/summary');

export const getBlogPost = (id: string) => blogRequest<BlogPost>(`/posts/${encodeURIComponent(id)}`);

export const createBlogPost = (input: BlogPostInput) => blogRequest<{ post: BlogPost }>('/posts', { method: 'POST', body: input });
export const updateBlogPost = (id: string, input: BlogPostInput) =>
  blogRequest<{ post: BlogPost }>(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
export const deleteBlogPost = (id: string) => blogRequest(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** 잠긴 글의 '주인장에게 요청하기'. 로그인한 회원만 */
export const requestBlogAccess = (id: string, message: string) =>
  blogRequest<{ request: AccessRequestState }>(`/posts/${encodeURIComponent(id)}/access-requests`, { method: 'POST', body: { message } });

export interface ProofInput {
  /** 문제지의 문제 id */
  problem: string;
  proof: string;
  /** 같은 글에서 몇 번째 제출인지 (1부터) */
  attempt: number;
}

/**
 * 잠긴 글의 증명을 내고 AI 가 쓰는 빨간 펜 채점평을 받는 대로 onText 로 넘김. 점수는 늘 0점이고 글은 열리지 않음
 * 한 글자도 못 받으면(한도, AI 없음, 서버 오류) false. 부르는 쪽이 미리 적어 둔 채점평을 씀
 */
export async function streamProofGrade(id: string, input: ProofInput, onText: (text: string) => void, signal: AbortSignal): Promise<boolean> {
  let received = false;
  try {
    const response = await fetch(`/api/blog/posts/${encodeURIComponent(id)}/proofs`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
    if (!response.ok || !response.body) return false;
    // Safari 는 ReadableStream 을 for await 로 못 돌려서 reader 로 읽음
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      if (!chunk.value) continue;
      received = true;
      onText(chunk.value);
    }
  } catch {
    // 중간에 끊기면 받은 데까지만 씀
  }
  return received;
}
