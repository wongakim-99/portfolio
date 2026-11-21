'use client';

import { useState, type FormEvent } from 'react';
import { cx, formatStamp } from '@shared/lib';
import { FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { SEND_FALLBACK_TEXT, SEND_RESULT_TEXT, sendMessage, type MessageInput } from '@entities/message';
import './postcard.css';

// 홈의 쪽지 엽서. 받은 쪽지는 피드 관리실 쪽지함에서 봄 (POST /api/messages)
export function PostcardForm() {
  const [sending, setSending] = useState(false);
  const [sentOn, setSentOn] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(NO_STATUS);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setSending(true);
    setStatus({ message: '보내는 중...' });
    try {
      const response = await sendMessage(Object.fromEntries(new FormData(form)) as unknown as MessageInput);
      setStatus({ message: SEND_RESULT_TEXT[response.status] ?? SEND_FALLBACK_TEXT, tone: response.ok ? 'ok' : 'error' });
      if (response.ok) {
        form.reset();
        setSentOn(formatStamp(Date.now()).slice(0, 10));
      }
    } catch {
      setStatus({ message: SEND_FALLBACK_TEXT, tone: 'error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <form className={cx('postcard', sentOn && 'is-sent')} noValidate onSubmit={submit} onInput={() => setSentOn(null)}>
        <label className="pc-message" htmlFor="pc-message">
          <span className="sr">메시지</span>
          <textarea id="pc-message" name="message" required minLength={5} maxLength={2000} rows={7} placeholder="여기에 적어 주세요" />
        </label>
        <div className="pc-side">
          <span className="pc-stamp" aria-hidden="true">
            <span className="pc-stamp-lid" />
            <small>홈서버 우편</small>
          </span>
          <span className="pc-postmark" aria-hidden="true">
            보냄<small>{sentOn}</small>
          </span>
          <p className="pc-to">
            받는 사람 <b>김가원</b>
          </p>
          <label className="pc-field" htmlFor="pc-name">
            <span>보내는 사람</span>
            <input id="pc-name" name="name" required maxLength={40} autoComplete="name" />
          </label>
          <label className="pc-field" htmlFor="pc-email">
            <span>
              답장 받을 메일 <em>(선택)</em>
            </span>
            <input id="pc-email" name="email" type="email" maxLength={100} autoComplete="email" />
          </label>
          {/* 봇 차단용 칸(honeypot). 사람에게는 보이지 않음 */}
          <label className="hp" aria-hidden="true">
            웹사이트
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <button className="tape" type="submit" disabled={sending}>
            보내기
          </button>
        </div>
      </form>
      <FormStatus status={status} />
    </>
  );
}
