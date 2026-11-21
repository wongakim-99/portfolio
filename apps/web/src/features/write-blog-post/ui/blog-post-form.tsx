'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { cx, formatCount } from '@shared/lib';
import { FormStatus, NO_STATUS, type Status } from '@shared/ui';
import {
  BLOG_LIMITS,
  clearBlogDraft,
  createBlogPost,
  readBlogDraft,
  saveBlogDraft,
  updateBlogPost,
  VISIBILITY_LABEL,
  type BlogPostInput,
  type Visibility,
} from '@entities/blog-post';
import './blog-post-form.css';

// 실수로 넋두리를 공개하는 쪽이 기술 글을 잠그는 쪽보다 곤란하므로 새 글은 '허락한 사람만'으로 시작함
const EMPTY: BlogPostInput = { title: '', body: '', visibility: 'approved' };

const VISIBILITY_HINT: Record<Visibility, string> = {
  public: '누구나 읽습니다. 기술 글이나 남에게도 쓸모 있는 글',
  approved: '제목만 보이고 본문은 허락한 회원만. 나머지는 리만 가설부터 풀어야 합니다',
  private: '목록에도 안 보이고 나만 읽습니다',
};

interface BlogPostFormProps {
  /** 고칠 글 ID. 없으면 새 글 */
  postId?: string;
  initial?: BlogPostInput;
  /** 새 글이면 이 브라우저에 남겨 둔 임시 글로 시작함. 로그인을 확인한 뒤에만 켬 */
  restoreDraft?: boolean;
  disabled?: boolean;
  initialStatus?: Status;
}

function startingDraft(initial: BlogPostInput | undefined, restoreDraft: boolean): BlogPostInput {
  if (!restoreDraft) return initial ?? EMPTY;
  const saved = readBlogDraft();
  return { ...EMPTY, ...saved };
}

export function BlogPostForm({ postId, initial, restoreDraft = false, disabled = false, initialStatus = NO_STATUS }: BlogPostFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => startingDraft(initial, restoreDraft));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialStatus);

  function change(next: BlogPostInput) {
    setDraft(next);
    if (!postId) saveBlogDraft(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setStatus({ message: postId ? '고치는 중입니다.' : '글을 올리는 중입니다.' });
    try {
      const { post } = postId ? await updateBlogPost(postId, draft) : await createBlogPost(draft);
      if (!postId) clearBlogDraft();
      router.push(routes.blogPost(post.id));
    } catch (error) {
      setStatus({ message: errorMessage(error), tone: 'error' });
      setBusy(false);
    }
  }

  return (
    <>
      <form className="community-form blog-form" onSubmit={submit}>
        <label htmlFor="blog-title">제목</label>
        <input
          id="blog-title"
          name="title"
          required
          minLength={BLOG_LIMITS.titleMin}
          maxLength={BLOG_LIMITS.titleMax}
          placeholder="글 제목"
          value={draft.title}
          onChange={(event) => change({ ...draft, title: event.target.value })}
        />
        <fieldset className="blog-visibility">
          <legend>누가 읽을 수 있나요</legend>
          {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((visibility) => (
            <label key={visibility} className={cx('blog-visibility-option', draft.visibility === visibility && 'is-checked')}>
              <input
                type="radio"
                name="visibility"
                value={visibility}
                checked={draft.visibility === visibility}
                onChange={() => change({ ...draft, visibility })}
              />
              <b>{VISIBILITY_LABEL[visibility]}</b>
              <span>{VISIBILITY_HINT[visibility]}</span>
            </label>
          ))}
        </fieldset>
        <label htmlFor="blog-body">본문</label>
        <textarea
          id="blog-body"
          name="body"
          required
          minLength={BLOG_LIMITS.bodyMin}
          maxLength={BLOG_LIMITS.bodyMax}
          rows={18}
          placeholder="여기에 글을 써 주세요"
          value={draft.body}
          onChange={(event) => change({ ...draft, body: event.target.value })}
        />
        <div className="community-form-foot">
          <span>{formatCount(draft.body.length, BLOG_LIMITS.bodyMax)}</span>
          <button className="tape tape-lg" type="submit" disabled={busy || disabled}>
            {postId ? '고친 내용 저장' : '글 올리기'}
          </button>
        </div>
      </form>
      <FormStatus status={status} />
    </>
  );
}
