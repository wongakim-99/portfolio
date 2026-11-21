'use client';

import { usePathname } from 'next/navigation';
import { useState, type FormEvent, type Ref } from 'react';
import { errorMessage } from '@shared/api';
import { formatDate } from '@shared/lib';
import { FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { BLOG_LIMITS, requestBlogAccess, type AccessRequestState } from '@entities/blog-post';
import { useSession } from '@entities/user';
import './request-access.css';

interface RequestAccessProps {
  postId: string;
  /** 이 글에 내가 이미 보낸 요청 */
  request: AccessRequestState | null;
  onRequested: (request: AccessRequestState) => void;
  /** 문제지의 '그냥 부탁할게요' 가 이 칸으로 스크롤하고 초점을 옮김 */
  ref?: Ref<HTMLElement>;
}

/** 잠긴 글 아래 '주인장에게 요청하기'. 허락은 계정에 붙으므로 로그인부터 */
export function RequestAccess({ postId, request, onRequested, ref }: RequestAccessProps) {
  const pathname = usePathname();
  const { user, requestLogin } = useSession();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  // 화면을 연 시각 기준. 거절 뒤 다시 보낼 수 있는 날이 지났는지 봄 (실제 판단은 API 가 함)
  const [openedAt] = useState(() => Date.now());
  const retryOpen = request?.status === 'rejected' && (!request.retryAt || new Date(request.retryAt).getTime() <= openedAt);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus({ message: '쪽지를 접어서 보내는 중입니다.' });
    try {
      const { request: sent } = await requestBlogAccess(postId, message);
      setStatus(NO_STATUS);
      onRequested(sent);
    } catch (error) {
      setStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (!user) {
    body = (
      <>
        <p>증명 대신 주인장에게 직접 부탁할 수도 있습니다. 누가 보는지 알아야 해서 로그인한 분만 요청할 수 있어요.</p>
        <button className="tape tape-lg" type="button" onClick={() => requestLogin(pathname)}>
          로그인하고 요청하기
        </button>
      </>
    );
  } else if (request?.status === 'pending') {
    body = (
      <p className="hand request-note">
        {formatDate(request.createdAt)}에 요청을 보냈습니다. 주인장이 읽어 보고 정합니다. 심사 기간은 P = NP 증명보다는 짧습니다.
      </p>
    );
  } else if (request?.status === 'rejected' && !retryOpen) {
    body = (
      <p className="hand request-note">
        주인장이 이번에는 정중히 거절했습니다.{request.retryAt ? ` ${formatDate(request.retryAt)}부터 다시 부탁해 볼 수 있어요.` : ''}
      </p>
    );
  } else {
    body = (
      <form className="community-form request-form" onSubmit={submit}>
        <p>
          {retryOpen ? '다시 부탁해 볼 수 있어요. ' : '증명 대신 주인장에게 직접 부탁할 수도 있습니다. '}
          {user.name}님 계정으로 요청이 가고, 허락하면 메일로 알려 드려요.
        </p>
        <label htmlFor="request-message">
          주인장에게 한마디 <small>안 써도 됩니다</small>
        </label>
        <textarea
          id="request-message"
          rows={3}
          maxLength={BLOG_LIMITS.requestMax}
          placeholder="어떻게 아는 사이인지 적어 주시면 허락이 빨라집니다"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button className="tape tape-lg" type="submit" disabled={busy}>
          주인장에게 요청하기
        </button>
      </form>
    );
  }

  return (
    <section ref={ref} className="request-access" aria-labelledby="request-title" tabIndex={-1}>
      <h3 id="request-title">주인장에게 요청하기</h3>
      {body}
      <FormStatus status={status} />
    </section>
  );
}
