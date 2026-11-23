'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { cx } from '@shared/lib';
import type { Status } from '@shared/ui';
import { getRoomOverview, suggestDraftRoom, type BlogRoom } from '@entities/blog-post';

interface RoomPickerProps {
  roomId: string | null;
  onChange: (roomId: string | null) => void;
  /** AI 추천에 쓸 지금 쓰고 있는 글 */
  draft: { title: string; body: string; tags: string[] };
  onStatus: (status: Status) => void;
}

/** 글이 들 방 고르기. 'AI 추천' 은 쓰고 있는 제목과 본문으로 방을 골라 줌 (저장은 글을 올릴 때) */
export function RoomPicker({ roomId, onChange, draft, onStatus }: RoomPickerProps) {
  const [rooms, setRooms] = useState<BlogRoom[] | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let active = true;
    getRoomOverview().then(
      (overview) => active && setRooms(overview.rooms),
      () => active && setRooms([]),
    );
    return () => {
      active = false;
    };
  }, []);

  async function askAi() {
    setAsking(true);
    try {
      const { roomId: picked } = await suggestDraftRoom(draft);
      const room = rooms?.find((item) => item.id === picked);
      if (room) onChange(room.id);
      onStatus(room ? { message: `'${room.name}' 이 어울린다고 골랐어요.`, tone: 'ok' } : { message: '어울리는 방을 못 찾았어요. 직접 골라 주세요.' });
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setAsking(false);
    }
  }

  if (rooms === null) return null;
  return (
    <fieldset className="blog-rooms">
      <legend>어느 방에 둘까요</legend>
      {rooms.length === 0 ? (
        <p className="blog-rooms-empty">
          아직 방이 없어요. <Link href={routes.blogRooms}>관리실에서 방 만들기</Link>
        </p>
      ) : (
        <div className="blog-rooms-list">
          {[...rooms, null].map((room) => {
            const id = room?.id ?? null;
            return (
              <label key={id ?? 'none'} className={cx('blog-room-option', roomId === id && 'is-checked')}>
                <input type="radio" name="room" checked={roomId === id} onChange={() => onChange(id)} />
                {room?.name ?? '방 없이'}
              </label>
            );
          })}
          <button
            className="text-btn blog-rooms-ai"
            type="button"
            disabled={asking || !(draft.title.trim() || draft.body.trim())}
            onClick={askAi}
          >
            {asking ? '고르는 중' : 'AI 추천'}
          </button>
        </div>
      )}
    </fieldset>
  );
}
