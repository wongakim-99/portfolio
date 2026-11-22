'use client';

import { useRef, useState } from 'react';
import { errorMessage } from '@shared/api';
import type { Status } from '@shared/ui';
import { blogImageUrl, firstImageUrl, uploadBlogImage } from '@entities/blog-post';
import { isImage, prepareImage } from '../lib/prepare-image';

interface CoverPickerProps {
  /** 고른 표지 사진 파일. null 이면 본문 첫 사진을 씀 */
  cover: string | null;
  body: string;
  onChange: (cover: string | null) => void;
  onStatus: (status: Status) => void;
}

/** 썸네일(표지) 고르기. 따로 고르지 않으면 본문 첫 사진이 목록 카드에 붙음 */
export function CoverPicker({ cover, body, onChange, onStatus }: CoverPickerProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const fallback = cover ? null : firstImageUrl(body);
  const shown = cover ? blogImageUrl(cover) : fallback;

  async function choose(file: File) {
    if (!isImage(file)) {
      onStatus({ message: 'JPG, PNG, WebP 같은 사진만 고를 수 있습니다.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const { image } = await uploadBlogImage(await prepareImage(file));
      onChange(image.file);
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="blog-cover" aria-labelledby="blog-cover-title">
      <div className="blog-cover-frame" data-fallback={fallback ? true : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown ? <img src={shown} alt="" /> : <span>썸네일 없음</span>}
      </div>
      <div className="blog-cover-text">
        <h2 id="blog-cover-title">썸네일</h2>
        <p>
          {cover
            ? '목록 카드와 글 맨 위에 이 사진이 붙어요.'
            : fallback
              ? '따로 고르지 않아서 본문 첫 사진이 목록 카드에 붙어요.'
              : '본문에 사진을 넣거나 표지를 고르면 목록 카드에 썸네일이 붙어요.'}
        </p>
        <div className="blog-cover-actions">
          <button className="text-btn" type="button" disabled={busy} onClick={() => picker.current?.click()}>
            {busy ? '올리는 중' : cover ? '다른 사진으로 바꾸기' : '표지 사진 고르기'}
          </button>
          {cover && (
            <button className="text-btn text-btn-danger" type="button" onClick={() => onChange(null)}>
              표지 빼기
            </button>
          )}
        </div>
      </div>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void choose(file);
        }}
      />
    </section>
  );
}
