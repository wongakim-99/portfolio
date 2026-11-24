'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearLocalDraft, saveBlogDraft, saveLocalDraft, type BlogPostInput } from '@entities/blog-post';
import { contentKey } from './draft-start';

// 손을 멈추고 3초 뒤에 서버에 남기되, 쉬지 않고 쳐도 30초는 넘기지 않음. 못 남기면 15초 뒤에 다시
const IDLE_MS = 3_000;
const MAX_WAIT_MS = 30_000;
const RETRY_MS = 15_000;

export type AutosaveState = { phase: 'idle' } | { phase: 'saving' } | { phase: 'saved'; at: string } | { phase: 'failed' };

interface AutosaveOptions {
  /** 고치는 글 ID. 새 글이면 없음 */
  postId?: string;
  draft: BlogPostInput;
  /** 서버에 이미 있는 내용. 글쓰기 칸이 이것과 같으면 남길 게 없음 */
  synced: BlogPostInput;
  /** 꺼 두면 이 기기에도 서버에도 남기지 않음 (주인장이 아니거나 불러오는 중) */
  enabled: boolean;
  /** 사진을 올리는 중이면 본문에 임시 주소가 들어 있어 서버에는 남기지 않음 */
  paused: boolean;
}

/**
 * 글쓰기 임시저장. 이 기기에는 칠 때마다, 서버에는 쉬는 틈마다 남겨서 다른 기기에서도 이어 씀
 * 서버에 남기면 이 기기 것은 지움. 이 기기에는 서버에 아직 못 남긴 것만 있음
 */
export function useAutosave({ postId, draft, synced, enabled, paused }: AutosaveOptions) {
  const key = contentKey(draft);
  const latest = useRef(draft);
  const blocked = useRef(paused);
  const syncedKey = useRef(contentKey(synced));
  // 서버에 남기지 못한 내용이 처음 생긴 때. 쉬지 않고 쳐도 여기서 30초가 지나면 남김
  const dirtySince = useRef<number | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const held = useRef(!enabled);
  const [round, setRound] = useState(0);
  const [state, setState] = useState<AutosaveState>({ phase: 'idle' });

  useEffect(() => {
    latest.current = draft;
    blocked.current = paused;
  });

  const flush = useCallback(async () => {
    // 한 번에 하나씩. 앞에 보낸 것이 끝난 뒤의 내용으로 다시 봄
    while (inflight.current) await inflight.current;
    const snapshot = latest.current;
    const snapshotKey = contentKey(snapshot);
    if (held.current || blocked.current || snapshotKey === syncedKey.current) return;
    setState({ phase: 'saving' });
    const run = saveBlogDraft(postId, snapshot).then(
      ({ savedAt }) => {
        syncedKey.current = snapshotKey;
        dirtySince.current = null;
        // 보내는 동안 더 쳤으면 이 기기 것은 남겨 둠
        if (contentKey(latest.current) === snapshotKey) clearLocalDraft(postId);
        setState({ phase: 'saved', at: savedAt });
      },
      () => {
        // 서버가 안 될 때 칠 때마다 보내지 않게 기다리는 시간을 처음부터 다시 셈
        dirtySince.current = Date.now();
        setState({ phase: 'failed' });
      },
    );
    inflight.current = run;
    await run;
    inflight.current = null;
  }, [postId]);

  useEffect(() => {
    if (!enabled) return;
    if (key === syncedKey.current) {
      clearLocalDraft(postId);
      return;
    }
    saveLocalDraft(postId, latest.current);
    if (paused) return;
    dirtySince.current ??= Date.now();
    const timer = setTimeout(() => void flush(), Math.min(IDLE_MS, Math.max(0, dirtySince.current + MAX_WAIT_MS - Date.now())));
    return () => clearTimeout(timer);
  }, [key, enabled, paused, postId, flush, round]);

  useEffect(() => {
    if (state.phase !== 'failed') return;
    const timer = setTimeout(() => void flush(), RETRY_MS);
    return () => clearTimeout(timer);
  }, [state, flush]);

  // 다른 탭으로 가거나 창을 내리면 바로 남김. 글쓰기 화면을 떠날 때도
  useEffect(() => {
    if (!enabled) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [enabled, flush]);

  /** 글을 올리거나 임시 글을 버리기 전에 부름. 보내던 것이 끝나길 기다리고, release 전까지는 남기지 않음 */
  const hold = useCallback(async () => {
    held.current = true;
    while (inflight.current) await inflight.current;
  }, []);

  /** 올리기가 실패해 계속 쓸 때. 그동안 친 것이 있으면 다시 쉬는 틈을 기다려 남김 */
  const release = useCallback(() => {
    held.current = !enabled;
    dirtySince.current = null;
    setRound((value) => value + 1);
  }, [enabled]);

  /** 임시 글을 버린 뒤. 이 내용을 서버에 있는 것으로 보고 처음부터 셈 */
  const reset = useCallback((content: BlogPostInput) => {
    syncedKey.current = contentKey(content);
    dirtySince.current = null;
    setState({ phase: 'idle' });
  }, []);

  return { state, hold, release, reset };
}
