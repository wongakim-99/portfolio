import { describe, expect, it } from 'vitest';
import type { BlogDraft, BlogPost } from '@entities/blog-post';
import { draftStart, EMPTY } from './draft-start';

const draft = (title: string, savedAt: string, extra: Partial<BlogDraft> = {}): BlogDraft => ({ ...EMPTY, title, body: `${title} 본문`, savedAt, ...extra });

const post = {
  id: 'p1', title: '올린 글', body: '올린 본문', visibility: 'public', locked: false, tags: ['기술'], cover: null, coverFile: null,
  room: { id: 'r1', name: '공부방' }, readMinutes: 1, request: null, videos: [], createdAt: '2026-11-20T00:00:00.000Z', updatedAt: '2026-11-22T00:00:00.000Z',
} satisfies BlogPost;

describe('draftStart', () => {
  it('임시 글이 없으면 빈 글로 시작하고, 열기만 해서는 서버에 남기지 않음', () => {
    expect(draftStart(null, null, null)).toEqual({ base: EMPTY, restored: null, synced: EMPTY });
  });

  it('서버와 이 브라우저 가운데 늦게 남긴 쪽으로 이어 씀', () => {
    const server = draft('서버', '2026-11-24T05:00:00.000Z');
    const local = draft('이 기기', '2026-11-24T05:01:00.000Z');
    const fromLocal = draftStart(null, server, local);
    expect(fromLocal.restored).toEqual({ content: expect.objectContaining({ title: '이 기기' }), savedAt: local.savedAt });
    // 이 기기 것이 늦으면 서버에는 아직 없는 것이라 다시 남김
    expect(fromLocal.synced.title).toBe('서버');
    const fromServer = draftStart(null, { ...server, savedAt: '2026-11-24T06:00:00.000Z' }, local);
    expect(fromServer.restored?.content.title).toBe('서버');
    expect(fromServer.synced).toEqual(fromServer.restored?.content);
  });

  it('서버 임시 글을 못 받으면 이 브라우저 것으로 이어 쓰고, 예전 임시 글(savedAt 없음)도 받음', () => {
    const local = draft('예전 임시 글', new Date(0).toISOString());
    const start = draftStart(null, null, local);
    expect(start.restored?.content.title).toBe('예전 임시 글');
    expect(start.synced).toEqual(EMPTY);
  });

  it('고치는 글은 올린 글로 시작하고, 마지막으로 올린 뒤에 남긴 임시 글만 이어 씀', () => {
    const base = { title: '올린 글', body: '올린 본문', visibility: 'public', tags: ['기술'], cover: null, roomId: 'r1' };
    expect(draftStart(post, null, null)).toEqual({ base, restored: null, synced: base });
    expect(draftStart(post, draft('올리기 전에 고치던 것', '2026-11-21T00:00:00.000Z'), null).restored).toBeNull();
    expect(draftStart(post, null, draft('올린 뒤에 고치는 것', '2026-11-23T00:00:00.000Z')).restored?.content.title).toBe('올린 뒤에 고치는 것');
  });

  it('비었거나 올린 글과 같은 임시 글은 없는 것으로 봄', () => {
    expect(draftStart(null, { ...EMPTY, visibility: 'public', savedAt: '2026-11-24T05:00:00.000Z' }, null).restored).toBeNull();
    const same = { title: '올린 글', body: '올린 본문', visibility: 'public' as const, tags: ['기술'], cover: null, roomId: 'r1', savedAt: '2026-11-23T00:00:00.000Z' };
    expect(draftStart(post, same, null).restored).toBeNull();
  });
});
