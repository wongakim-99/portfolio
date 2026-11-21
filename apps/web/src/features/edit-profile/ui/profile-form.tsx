'use client';

import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { updateProfile, type Profile } from '@entities/user';

/** 내 페이지의 표시 이름과 소개. 이름을 바꾸면 그동안 쓴 글과 댓글의 이름도 API 가 같이 바꿈 */
export function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(NO_STATUS);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setBusy(true);
    try {
      const { user } = await updateProfile(Object.fromEntries(new FormData(form)));
      onSaved(user);
      setStatus({ message: '프로필을 저장했습니다.', tone: 'ok' });
    } catch (error) {
      setStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="community-form" onSubmit={submit}>
        <label htmlFor="profile-name-input">표시 이름</label>
        <input id="profile-name-input" name="name" required minLength={2} maxLength={30} autoComplete="nickname" defaultValue={profile.name} />
        <label htmlFor="profile-bio-input">
          소개 <small>300자까지, 줄바꿈 그대로 보임</small>
        </label>
        <textarea id="profile-bio-input" name="bio" maxLength={300} rows={4} placeholder="어떤 이야기를 쓰는 사람인지 적어 주세요" defaultValue={profile.bio} />
        <button className="tape" type="submit" disabled={busy}>
          프로필 저장
        </button>
      </form>
      <FormStatus status={status} />
    </>
  );
}
