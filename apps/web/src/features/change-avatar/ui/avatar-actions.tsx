'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { errorMessage, errorStatus } from '@shared/api';
import type { Status } from '@shared/ui';
import { deleteAvatar, uploadAvatar } from '@entities/user';
import { squarePhoto } from '../lib/square-photo';

const MAX_FILE = 40 * 1024 * 1024;

interface AvatarActionsProps {
  hasPhoto: boolean;
  onChange: (avatarUrl: string | null) => void;
  /** 상태 문구는 이름 아래에 보여서 부르는 쪽이 그림 */
  onStatus: (status: Status) => void;
}

/** 내 페이지의 사진 바꾸기, 지우기. 사진은 MinIO 에 저장되고 API 가 내보냄 */
export function AvatarActions({ hasPhoto, onChange, onStatus }: AvatarActionsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setBusy(true);
    onStatus({ message: '사진을 다듬어 올리는 중입니다.' });
    try {
      if (file.size > MAX_FILE) throw new Error('40MB 이하 사진을 골라 주세요.');
      const photo = await squarePhoto(file);
      if (!photo) throw new Error('사진을 변환하지 못했습니다. 다른 사진으로 골라 주세요.');
      const { avatarUrl } = await uploadAvatar(photo);
      onChange(avatarUrl);
      onStatus({ message: '프로필 사진을 바꿨습니다.', tone: 'ok' });
    } catch (error) {
      onStatus({ message: errorStatus(error) === 413 ? '사진이 너무 큽니다. 다른 사진으로 골라 주세요.' : errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('프로필 사진을 지울까요?')) return;
    try {
      await deleteAvatar();
      onChange(null);
      onStatus({ message: '프로필 사진을 지웠습니다.', tone: 'ok' });
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    }
  }

  return (
    <div className="profile-photo-actions">
      <button className="tape" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
        사진 바꾸기
      </button>
      {hasPhoto && (
        <button className="text-btn" type="button" onClick={remove}>
          사진 지우기
        </button>
      )}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}
