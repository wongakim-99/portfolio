'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@shared/api';
import { formatDateTime } from '@shared/lib';
import type { Status } from '@shared/ui';
import { deleteMessage, listInbox, markInboxRead, setUnreadMessages, type InboxMessage } from '@entities/message';
import { useSession } from '@entities/user';
import './admin-inbox.css';

const REPLY_SUBJECT = encodeURIComponent('[김가원 포트폴리오] 쪽지 답장');

interface InboxState {
  messages: InboxMessage[];
  cursor: string | null;
  meta: string;
  /** 목록이 비었거나 불러오지 못했을 때 대신 보여 줄 글 */
  empty: string | null;
}

/** 홈 엽서로 받은 쪽지. 권한(messages:read)이 있을 때만 보임 */
export function AdminInbox({ onStatus }: { onStatus: (status: Status) => void }) {
  const { can } = useSession();
  const [state, setState] = useState<InboxState>({ messages: [], cursor: null, meta: '', empty: null });

  // 첫 쪽만 effect 에서 받음. 개발 모드에서 effect 가 두 번 돌면 먼저 받은 결과는 버려서 읽음 처리가 한 번만 일어남
  useEffect(() => {
    let active = true;
    listInbox().then(
      (page) => {
        if (!active) return;
        setState({
          messages: page.messages,
          cursor: page.nextCursor,
          meta: page.unread ? `새 쪽지 ${page.unread}개` : '모두 읽음',
          empty: page.messages.length ? null : '받은 쪽지가 없습니다. 홈의 엽서로 쪽지가 오면 여기에 쌓입니다.',
        });
        // 지금 화면에는 '새 쪽지' 표시를 남겨 두고, 다음에 열 때부터는 읽은 것으로 봄
        if (page.unread) markInboxRead().then(() => setUnreadMessages(0), () => {});
      },
      (error) => active && setState((prev) => ({ ...prev, empty: errorMessage(error) })),
    );
    return () => {
      active = false;
    };
  }, []);

  const loadMore = useCallback(async (before: string) => {
    try {
      const page = await listInbox(before);
      setState((prev) => ({ ...prev, messages: [...prev.messages, ...page.messages], cursor: page.nextCursor }));
    } catch (error) {
      setState((prev) => ({ ...prev, messages: [], empty: errorMessage(error) }));
    }
  }, []);

  async function remove(item: InboxMessage) {
    if (!confirm(`${item.name}님의 쪽지를 삭제할까요?`)) return;
    try {
      await deleteMessage(item.id);
      setState((prev) => {
        const messages = prev.messages.filter((message) => message.id !== item.id);
        return { ...prev, messages, empty: messages.length ? null : '받은 쪽지가 없습니다.' };
      });
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    }
  }

  return (
    <section className="admin-block" aria-labelledby="inbox-title">
      <div className="community-section-head">
        <h3 id="inbox-title">쪽지함</h3>
        <span className="community-meta">{state.meta}</span>
      </div>
      <div aria-live="polite">
        {state.empty && <p className="community-empty">{state.empty}</p>}
        {state.messages.map((item) => (
          <article className="inbox-card" key={item.id}>
            <header className="inbox-head">
              <p className="inbox-from">
                <b>{item.name}</b>
              </p>
              {!item.readAt && <span className="inbox-new">새 쪽지</span>}
            </header>
            <p className="inbox-body">{item.message}</p>
            <div className="community-meta inbox-foot">
              <span>{formatDateTime(item.createdAt)}</span>
              {item.email ? (
                <a className="text-btn" href={`mailto:${item.email}?subject=${REPLY_SUBJECT}`}>
                  {item.email}로 답장
                </a>
              ) : (
                <span>답장 메일 없음</span>
              )}
              {can('messages:delete') && (
                <button className="text-btn" type="button" onClick={() => remove(item)}>
                  삭제
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {state.cursor && (
        <button className="btn-line community-more" type="button" onClick={() => loadMore(state.cursor!)}>
          쪽지 더 보기
        </button>
      )}
    </section>
  );
}
