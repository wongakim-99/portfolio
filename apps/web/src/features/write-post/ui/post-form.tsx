'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { formatCount } from '@shared/lib';
import { FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { POST_LIMITS, updatePost } from '@entities/post';

/** 고칠 글의 지금 내용. 제목은 예전 긴 글만 있음 */
export interface PostEdit {
  title: string;
  body: string;
  /** 붙어 있는 사진 파일. 고치는 동안 그대로 둠 */
  photos: string[];
  link: string;
}

const EMPTY: PostEdit = { title: '', body: '', photos: [], link: '' };

interface PostFormProps {
  postId: string;
  initial?: PostEdit;
  /** 글을 아직 못 불러왔거나 로그인 전이면 보내기를 막음 */
  disabled?: boolean;
  initialStatus?: Status;
}

/** 내 글 고치기. 지금 글은 500자와 링크 칸, 예전에 쓴 제목 있는 긴 글은 제목과 긴 본문 그대로. 사진은 그대로 둠 */
export function PostForm({ postId, initial = EMPTY, disabled = false, initialStatus = NO_STATUS }: PostFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const long = Boolean(initial.title);
  const max = long ? POST_LIMITS.bodyMax : POST_LIMITS.shortMax;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setStatus({ message: '수정하는 중입니다.' });
    try {
      const { title, body, photos, link } = draft;
      await updatePost(postId, long ? { title, body, photos } : { body, photos, link: link.trim() || undefined });
      router.push(routes.post(postId));
    } catch (error) {
      setStatus({ message: errorMessage(error), tone: 'error' });
      setBusy(false);
    }
  }

  return (
    <>
      <form className="community-form post-form" onSubmit={submit}>
        {long && (
          <>
            <label htmlFor="editor-heading">제목</label>
            <input
              id="editor-heading"
              name="title"
              required
              minLength={POST_LIMITS.titleMin}
              maxLength={POST_LIMITS.titleMax}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </>
        )}
        <label htmlFor="editor-body">본문</label>
        <textarea
          id="editor-body"
          name="body"
          required={long || (!draft.photos.length && !draft.link.trim())}
          minLength={long ? POST_LIMITS.bodyMin : undefined}
          maxLength={max}
          rows={long ? 18 : 8}
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
        />
        {!long && (
          <>
            <label htmlFor="editor-link">
              링크 <small>유튜브면 영상 카드, 다른 주소면 링크 카드로 붙어요</small>
            </label>
            <input
              id="editor-link"
              name="link"
              type="url"
              inputMode="url"
              maxLength={POST_LIMITS.linkMax}
              pattern="https?://.+"
              placeholder="https://"
              value={draft.link}
              onChange={(event) => setDraft({ ...draft, link: event.target.value })}
            />
          </>
        )}
        <div className="community-form-foot">
          <span>{formatCount(draft.body.length, max)}</span>
          <button className="tape tape-lg" type="submit" disabled={busy || disabled}>
            수정 저장
          </button>
        </div>
      </form>
      <FormStatus status={status} />
    </>
  );
}
