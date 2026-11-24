'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { cx, formatClock, formatCount, formatDateTime } from '@shared/lib';
import { FormStatus, NO_STATUS, type Status } from '@shared/ui';
import {
  BLOG_LIMITS,
  clearLocalDraft,
  createBlogPost,
  deleteBlogDraft,
  readLocalDraft,
  updateBlogPost,
  VISIBILITY_LABEL,
  type BlogDraft,
  type BlogPost,
  type BlogPostInput,
  type Visibility,
} from '@entities/blog-post';
import { draftStart } from '../lib/draft-start';
import { useAutosave, type AutosaveState } from '../lib/use-autosave';
import { CoverPicker } from './cover-picker';
import { RichEditor } from './rich-editor';
import { RoomPicker } from './room-picker';
import { TagInput } from './tag-input';
import './blog-post-form.css';

const VISIBILITY_HINT: Record<Visibility, string> = {
  public: '누구나 읽습니다. 기술 글이나 남에게도 쓸모 있는 글',
  approved: '제목만 보이고 본문은 허락한 회원만. 나머지는 리만 가설부터 풀어야 합니다',
  private: '목록에도 안 보이고 나만 읽습니다',
};

interface BlogPostFormProps {
  /** 고칠 글 ID. 없으면 새 글 */
  postId?: string;
  /** 고칠 글. 새 글이면 없음 */
  post?: BlogPost;
  /** 서버에 남은 임시 글. 이 브라우저에 남은 것과 견줘 늦게 남긴 쪽으로 이어 씀 */
  serverDraft?: BlogDraft | null;
  /** 로그인 확인 전, 불러오는 중, 주인장이 아닐 때. 임시 글을 불러오지도 남기지도 않음 */
  disabled?: boolean;
  initialStatus?: Status;
}

const AUTOSAVE_LABEL: Record<Exclude<AutosaveState['phase'], 'idle'>, string> = {
  saving: '임시저장 중',
  saved: '임시저장됨',
  failed: '임시저장 못 함, 이 기기에만 둠',
};

export function BlogPostForm({ postId, post, serverDraft = null, disabled = false, initialStatus = NO_STATUS }: BlogPostFormProps) {
  const router = useRouter();
  const [start] = useState(() => draftStart(post ?? null, disabled ? null : serverDraft, disabled ? null : readLocalDraft(postId)));
  const [draft, setDraft] = useState(start.restored?.content ?? start.base);
  const [restoredAt, setRestoredAt] = useState(start.restored?.savedAt ?? null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [uploading, setUploading] = useState(0);
  const autosave = useAutosave({ postId, draft, synced: start.synced, enabled: !disabled, paused: uploading > 0 });

  function change(next: Partial<BlogPostInput>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    // 본문은 textarea 가 아니라 브라우저 확인을 거치지 않으므로 여기서 길이를 봄
    if (draft.body.trim().length < BLOG_LIMITS.bodyMin) {
      setStatus({ message: '본문을 적어 주세요.', tone: 'error' });
      return;
    }
    if (draft.body.length > BLOG_LIMITS.bodyMax) {
      setStatus({ message: `본문은 ${BLOG_LIMITS.bodyMax.toLocaleString('ko-KR')}자까지 쓸 수 있습니다.`, tone: 'error' });
      return;
    }
    if (uploading > 0) {
      setStatus({ message: '사진을 다 올린 뒤에 저장해 주세요.', tone: 'error' });
      return;
    }
    setBusy(true);
    setStatus({ message: postId ? '고치는 중입니다.' : '글을 올리는 중입니다.' });
    // 늦게 도착한 임시저장이 올린 뒤에 임시 글을 되살리지 않게 멈춰 둠. 서버 임시 글은 API 가 올리면서 지움
    await autosave.hold();
    try {
      const { post: saved } = postId ? await updateBlogPost(postId, draft) : await createBlogPost(draft);
      clearLocalDraft(postId);
      router.push(routes.blogPost(saved.id));
    } catch (error) {
      autosave.release();
      setStatus({ message: errorMessage(error), tone: 'error' });
      setBusy(false);
    }
  }

  // 이어 쓰던 임시 글을 버리고 올린 글(새 글이면 빈 글)로 돌아감
  async function discard() {
    if (!confirm(postId ? '고치던 내용을 버리고 올린 글로 되돌릴까요?' : '쓰던 글을 버리고 새로 쓸까요?')) return;
    setBusy(true);
    await autosave.hold();
    try {
      await deleteBlogDraft(postId);
    } catch (error) {
      autosave.release();
      setStatus({ message: errorMessage(error), tone: 'error' });
      setBusy(false);
      return;
    }
    clearLocalDraft(postId);
    autosave.reset(start.base);
    autosave.release();
    setDraft(start.base);
    setRestoredAt(null);
    setStatus({ message: postId ? '올린 글로 되돌렸습니다.' : '쓰던 글을 버렸습니다.' });
    setBusy(false);
  }

  const saveState = autosave.state;

  return (
    <>
      <form className="blog-form" onSubmit={submit}>
        {restoredAt && (
          <p className="blog-draft-note">
            <span>{formatDateTime(restoredAt)}에 임시저장한 글을 이어 씁니다.</span>
            <button className="text-btn" type="button" disabled={busy} onClick={discard}>
              {postId ? '버리고 올린 글로' : '버리고 새로 쓰기'}
            </button>
          </p>
        )}
        <label className="sr" htmlFor="blog-title">
          제목
        </label>
        <input
          id="blog-title"
          className="blog-form-title"
          name="title"
          required
          minLength={BLOG_LIMITS.titleMin}
          maxLength={BLOG_LIMITS.titleMax}
          placeholder="제목을 입력하세요"
          value={draft.title}
          onChange={(event) => change({ title: event.target.value })}
        />
        <label className="sr" htmlFor="blog-tags">
          태그
        </label>
        <TagInput tags={draft.tags} onChange={(tags) => change({ tags })} />
        <RoomPicker
          roomId={draft.roomId}
          onChange={(roomId) => change({ roomId })}
          draft={{ title: draft.title, body: draft.body, tags: draft.tags }}
          onStatus={setStatus}
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
                onChange={() => change({ visibility })}
              />
              <b>{VISIBILITY_LABEL[visibility]}</b>
              <span>{VISIBILITY_HINT[visibility]}</span>
            </label>
          ))}
        </fieldset>
        <CoverPicker cover={draft.cover} body={draft.body} onChange={(cover) => change({ cover })} onStatus={setStatus} />
        <RichEditor
          value={draft.body}
          onChange={(body) => change({ body })}
          uploading={uploading}
          onUploading={(delta) => setUploading((count) => count + delta)}
          onStatus={setStatus}
        />
        {/* 글이 길어도 올리기 버튼이 늘 화면 아래에 보이게 붙여 둠 */}
        <div className="blog-form-bar">
          <span>{formatCount(draft.body.length, BLOG_LIMITS.bodyMax)}</span>
          {saveState.phase !== 'idle' && (
            <span className={cx('blog-form-saved', saveState.phase === 'failed' && 'is-failed')}>
              {saveState.phase === 'saved' && `${formatClock(saveState.at)} `}
              {AUTOSAVE_LABEL[saveState.phase]}
            </span>
          )}
          <FormStatus status={status} className="blog-form-status" />
          <button className="tape tape-lg" type="submit" disabled={busy || disabled}>
            {postId ? '고친 내용 저장' : '글 올리기'}
          </button>
        </div>
      </form>
    </>
  );
}
