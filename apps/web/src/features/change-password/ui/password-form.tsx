'use client';

import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import type { Status } from '@shared/ui';
import { changePassword } from '@entities/user';

/** 상태 문구는 바로 아래 로그아웃 버튼과 같이 쓰므로 부르는 쪽이 보여 줌 */
export function PasswordForm({ onStatus }: { onStatus: (status: Status) => void }) {
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setBusy(true);
    try {
      await changePassword(Object.fromEntries(new FormData(form)));
      form.reset();
      onStatus({ message: '비밀번호를 변경했습니다. 다른 기기의 로그인은 해제됩니다.', tone: 'ok' });
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="community-form" onSubmit={submit}>
      <label htmlFor="current-password">현재 비밀번호</label>
      <input id="current-password" name="currentPassword" type="password" required autoComplete="current-password" />
      <label htmlFor="new-password">
        새 비밀번호 <small>10자 이상</small>
      </label>
      <input id="new-password" name="newPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
      <button className="tape" type="submit" disabled={busy}>
        비밀번호 변경
      </button>
    </form>
  );
}
