'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import type { Status } from '@shared/ui';
import {
  assignRooms,
  createRoom,
  deleteRoom,
  getRoomOverview,
  renameRoom,
  reorderRooms,
  ROOM_NAME_MAX,
  suggestRooms,
  VISIBILITY_LABEL,
  type BlogRoom,
  type RoomOverview,
  type RoomSuggestion,
} from '@entities/blog-post';
import './admin-blog-rooms.css';

/** 관리실의 블로그 방: 방 만들기, 이름 바꾸기, 순서, 지우기, 방 없는 글을 AI 로 나누기 (blog:write) */
export function AdminBlogRooms({ onStatus }: { onStatus: (status: Status) => void }) {
  const [overview, setOverview] = useState<RoomOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // AI 가 고른 방. 주인장이 고쳐서 '이대로 넣기' 를 눌러야 저장됨
  const [picks, setPicks] = useState<RoomSuggestion[] | null>(null);

  const load = useCallback(
    () =>
      getRoomOverview().then(
        (value) => {
          setOverview(value);
          setError(null);
        },
        (reason) => setError(errorMessage(reason)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function run(task: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await task();
      await load();
      onStatus({ message: done, tone: 'ok' });
      return true;
    } catch (reason) {
      onStatus({ message: errorMessage(reason), tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next) return;
    if (await run(() => createRoom(next), `'${next}' 방을 만들었습니다.`)) setName('');
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const next = editing.name.trim();
    if (await run(() => renameRoom(editing.id, next), `방 이름을 '${next}' 로 바꿨습니다.`)) setEditing(null);
  }

  const move = (rooms: BlogRoom[], index: number, step: -1 | 1) => {
    const ids = rooms.map((room) => room.id);
    [ids[index], ids[index + step]] = [ids[index + step]!, ids[index]!];
    run(() => reorderRooms(ids), '방 순서를 바꿨습니다.');
  };

  const remove = (room: BlogRoom) => {
    const note = room.count ? ` 이 방의 글 ${room.count}개는 방 없는 글로 남습니다.` : '';
    if (!confirm(`'${room.name}' 방을 지울까요?${note}`)) return;
    run(() => deleteRoom(room.id), `'${room.name}' 방을 지웠습니다.`);
  };

  async function askAi() {
    setBusy(true);
    try {
      const { suggestions } = await suggestRooms();
      setPicks(suggestions);
      const found = suggestions.filter((item) => item.roomId).length;
      onStatus({ message: `글 ${suggestions.length}개 가운데 ${found}개에 어울리는 방을 골랐어요. 확인하고 '이대로 넣기' 를 눌러 주세요.`, tone: 'ok' });
    } catch (reason) {
      onStatus({ message: errorMessage(reason), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function applyPicks() {
    const assignments = (picks ?? []).flatMap((item) => (item.roomId ? [{ postId: item.post.id, roomId: item.roomId }] : []));
    if (!assignments.length) return;
    if (await run(() => assignRooms(assignments), `글 ${assignments.length}개를 방에 넣었습니다.`)) setPicks(null);
  }

  const rooms = overview?.rooms ?? [];
  const unsorted = overview?.unsorted ?? 0;
  const ready = picks?.filter((item) => item.roomId).length ?? 0;
  return (
    <>
      <section className="admin-block" id="blog-rooms" aria-labelledby="blog-rooms-title">
        <div className="community-section-head">
          <h3 id="blog-rooms-title">블로그 방</h3>
          <span className="community-meta">{overview ? `${rooms.length}개` : ''}</span>
        </div>
        {error && <p className="community-empty">{error}</p>}
        {overview && !rooms.length && <p className="community-empty">아직 방이 없습니다. 공부방, 잡담방처럼 글을 나눌 방을 만들어 보세요.</p>}
        {rooms.length > 0 && (
          <ol className="room-list">
            {rooms.map((room, index) => (
              <li key={room.id}>
                {editing?.id === room.id ? (
                  <form className="room-rename" onSubmit={saveName}>
                    <input
                      autoFocus
                      aria-label={`${room.name} 새 이름`}
                      value={editing.name}
                      maxLength={ROOM_NAME_MAX}
                      onChange={(event) => setEditing({ id: room.id, name: event.target.value })}
                      onKeyDown={(event) => event.key === 'Escape' && setEditing(null)}
                    />
                    <button className="tape" type="submit" disabled={busy || !editing.name.trim()}>
                      저장
                    </button>
                    <button className="text-btn" type="button" onClick={() => setEditing(null)}>
                      그만두기
                    </button>
                  </form>
                ) : (
                  <>
                    <Link className="room-name" href={routes.blogList({ room: room.id })}>
                      {room.name}
                    </Link>
                    <span className="community-meta">글 {room.count}개</span>
                    <span className="room-actions">
                      <button className="room-move" type="button" aria-label={`${room.name} 위로`} disabled={busy || index === 0} onClick={() => move(rooms, index, -1)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m6 15 6-6 6 6" />
                        </svg>
                      </button>
                      <button
                        className="room-move"
                        type="button"
                        aria-label={`${room.name} 아래로`}
                        disabled={busy || index === rooms.length - 1}
                        onClick={() => move(rooms, index, 1)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      <button className="text-btn" type="button" disabled={busy} onClick={() => setEditing({ id: room.id, name: room.name })}>
                        이름 바꾸기
                      </button>
                      <button className="text-btn text-btn-danger" type="button" disabled={busy} onClick={() => remove(room)}>
                        지우기
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        <form className="room-add" onSubmit={add}>
          <label className="sr" htmlFor="room-new">
            새 방 이름
          </label>
          <input id="room-new" value={name} maxLength={ROOM_NAME_MAX} placeholder="새 방 이름 (예: 독서방)" onChange={(event) => setName(event.target.value)} />
          <button className="tape" type="submit" disabled={busy || !name.trim()}>
            방 만들기
          </button>
        </form>
      </section>

      <section className="admin-block" aria-labelledby="blog-unsorted-title">
        <div className="community-section-head">
          <h3 id="blog-unsorted-title">방 없는 글</h3>
          <span className="community-meta">{overview ? `${unsorted}개` : ''}</span>
        </div>
        {overview && !unsorted && !picks && <p className="community-empty">모든 글이 방에 들어 있어요.</p>}
        {unsorted > 0 && !picks && (
          <div className="room-ai">
            <p className="community-meta">
              AI 가 글의 제목, 태그, 본문 앞부분을 읽고 방을 골라 줘요. 바로 저장하지 않고, 확인하고 고친 뒤에 넣어요.
            </p>
            {rooms.length ? (
              <button className="tape" type="button" disabled={busy} onClick={askAi}>
                {busy ? 'AI 가 고르는 중' : 'AI 로 나누기'}
              </button>
            ) : (
              <p className="community-meta">위에서 방을 먼저 만들어 주세요.</p>
            )}
          </div>
        )}
        {picks && (
          <>
            <ul className="room-picks">
              {picks.map((item) => (
                <li key={item.post.id}>
                  <Link className="room-pick-title" href={routes.blogPost(item.post.id)} target="_blank">
                    {item.post.title}
                  </Link>
                  <span className="community-meta">{VISIBILITY_LABEL[item.post.visibility]}</span>
                  <select
                    aria-label={`${item.post.title} 방`}
                    value={item.roomId ?? ''}
                    onChange={(event) =>
                      setPicks((current) => current?.map((pick) => (pick.post.id === item.post.id ? { ...pick, roomId: event.target.value || null } : pick)) ?? null)
                    }
                  >
                    <option value="">방 없이 두기</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <div className="room-picks-actions">
              <button className="tape" type="button" disabled={busy || !ready} onClick={applyPicks}>
                이대로 넣기 ({ready}개)
              </button>
              <button className="text-btn" type="button" disabled={busy} onClick={() => setPicks(null)}>
                그만두기
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
