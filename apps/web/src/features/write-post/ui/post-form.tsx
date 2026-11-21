'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { formatCount } from '@shared/lib';
import { FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { clearDraft, createPost, POST_LIMITS, readDraft, saveDraft, updatePost, type PostDraft } from '@entities/post';

const EMPTY: PostDraft = { title: '', body: '' };

interface PostFormProps {
  /** 수정할 글 ID. 없으면 새 글 */
  postId?: string;
  /** 수정할 글의 지금 내용 */
  initial?: PostDraft;
  /** 새 글이면 이 브라우저에 남겨 둔 임시 글로 시작함. 로그인을 확인한 뒤(브라우저에서 그린 뒤)에만 켬 */
  restoreDraft?: boolean;
  /** 글을 아직 못 불러왔거나 로그인 전이면 보내기를 막음 */
  disabled?: boolean;
  initialStatus?: Status;
}

function startingDraft(initial: PostDraft | undefined, restoreDraft: boolean): PostDraft {
  if (!restoreDraft) return initial ?? EMPTY;
  const saved = readDraft();
  return { title: saved?.title ?? '', body: saved?.body ?? '' };
}

export function PostForm({ postId, initial, restoreDraft = false, disabled = false, initialStatus = NO_STATUS }: PostFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => startingDraft(initial, restoreDraft));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialStatus);

  function change(next: PostDraft) {
    setDraft(next);
    // 새 글만 이 브라우저에 임시 저장함
    if (!postId) saveDraft(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setStatus({ message: postId ? '수정하는 중입니다.' : '글을 올리는 중입니다.' });
    try {
      const { post } = postId ? await updatePost(postId, draft) : await createPost(draft);
      if (!postId) clearDraft();
      router.push(routes.post(post.id));
    } catch (error) {
      setStatus({ message: errorMessage(error), tone: 'error' });
      setBusy(false);
    }
  }

  return (
    <>
      <form className="community-form post-form" onSubmit={submit}>
        <label htmlFor="editor-heading">제목</label>
        <input
          id="editor-heading"
          name="title"
          required
          minLength={POST_LIMITS.titleMin}
          maxLength={POST_LIMITS.titleMax}
          placeholder="글 제목"
          value={draft.title}
          onChange={(event) => change({ ...draft, title: event.target.value })}
        />
        <label htmlFor="editor-body">본문</label>
        <textarea
          id="editor-body"
          name="body"
          required
          minLength={POST_LIMITS.bodyMin}
          maxLength={POST_LIMITS.bodyMax}
          rows={18}
          placeholder="여기에 글을 써 주세요"
          value={draft.body}
          onChange={(event) => change({ ...draft, body: event.target.value })}
        />
        <div className="community-form-foot">
          <span>{formatCount(draft.body.length, POST_LIMITS.bodyMax)}</span>
          <button className="tape tape-lg" type="submit" disabled={busy || disabled}>
            {postId ? '수정 저장' : '글 올리기'}
          </button>
        </div>
      </form>
      <FormStatus status={status} />
    </>
  );
}
