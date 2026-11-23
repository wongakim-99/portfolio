'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { formatCount, isImage, prepareImage, youtubeIdIn } from '@shared/lib';
import { FormStatus, NO_STATUS, YoutubeCard, type Status, type YoutubeVideo } from '@shared/ui';
import { createPost, POST_LIMITS, previewVideo, uploadPostPhoto, type Post } from '@entities/post';
import { Avatar, useSession } from '@entities/user';
import './quick-post-form.css';

// 피드 사진은 블로그보다 작게 줄여 올림 (긴 변 1600px)
const PHOTO_SIDE = 1600;

interface Photo {
  /** 올리는 동안 보여 줄 브라우저 안 임시 주소 */
  preview: string;
  /** 다 올린 뒤의 파일 이름. 올리는 중이면 null */
  file: string | null;
}

/**
 * 피드 맨 위의 쓰기 칸. 제목 없이 500자까지, 사진 4장까지. 유튜브 링크를 넣으면 올리기 전에 미리보기 카드가 뜸
 * 올리면 onCreated 로 새 글을 넘겨 목록 맨 위에 바로 붙임
 */
export function QuickPostForm({ onCreated }: { onCreated: (post: Post) => void }) {
  const { user } = useSession();
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  /** 마지막으로 받은 유튜브 미리보기. 지금 글 속 링크와 같은 영상일 때만 보임 */
  const [preview, setPreview] = useState<YoutubeVideo | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const picker = useRef<HTMLInputElement>(null);
  const videoId = youtubeIdIn(body);
  const video = preview?.id === videoId ? preview : null;
  const uploading = photos.some((photo) => !photo.file);

  // 링크를 다 붙여 넣은 뒤에 한 번만 묻도록 잠깐 기다렸다가 미리보기를 받음
  useEffect(() => {
    if (!videoId) return;
    let active = true;
    const timer = setTimeout(() => {
      previewVideo(videoId).then(
        ({ video: found }) => active && setPreview(found),
        () => active && setPreview(null),
      );
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [videoId]);

  // 화면을 떠나면 임시 사진 주소를 돌려줌
  const previews = useRef(photos);
  useEffect(() => {
    previews.current = photos;
  }, [photos]);
  useEffect(() => () => previews.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  async function addPhotos(files: File[]) {
    const room = POST_LIMITS.photosMax - photos.length;
    const chosen = files.filter(isImage).slice(0, room);
    if (files.length > room) setStatus({ message: `사진은 ${POST_LIMITS.photosMax}장까지 붙일 수 있어요.`, tone: 'error' });
    for (const file of chosen) {
      const preview = URL.createObjectURL(file);
      setPhotos((list) => [...list, { preview, file: null }]);
      try {
        const { image } = await uploadPostPhoto(await prepareImage(file, PHOTO_SIDE));
        setPhotos((list) => list.map((photo) => (photo.preview === preview ? { ...photo, file: image.file } : photo)));
      } catch (error) {
        URL.revokeObjectURL(preview);
        setPhotos((list) => list.filter((photo) => photo.preview !== preview));
        setStatus({ message: errorMessage(error), tone: 'error' });
      }
    }
  }

  function removePhoto(preview: string) {
    URL.revokeObjectURL(preview);
    setPhotos((list) => list.filter((photo) => photo.preview !== preview));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() && !photos.length) return setStatus({ message: '글이나 사진을 넣어 주세요.', tone: 'error' });
    setBusy(true);
    setStatus(NO_STATUS);
    try {
      const { post } = await createPost({ body, photos: photos.flatMap((photo) => (photo.file ? [photo.file] : [])) });
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setBody('');
      setPhotos([]);
      onCreated(post);
    } catch (error) {
      setStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-row">
        <Avatar person={user} />
        <div className="composer-main">
          <label className="sr" htmlFor="composer-body">
            짧은 글 쓰기
          </label>
          <textarea
            id="composer-body"
            maxLength={POST_LIMITS.shortMax}
            rows={2}
            placeholder={`${user.name} 님, 무슨 생각을 하고 있나요?`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onPaste={(event) => {
              const files = [...event.clipboardData.files].filter(isImage);
              if (!files.length) return;
              event.preventDefault();
              addPhotos(files);
            }}
          />
          {photos.length > 0 && (
            <ul className="composer-photos">
              {photos.map((photo) => (
                <li key={photo.preview} data-uploading={!photo.file || undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.preview} alt="" />
                  <button type="button" onClick={() => removePhoto(photo.preview)} aria-label="사진 빼기">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {video && (
            <div className="composer-video">
              <span className="community-meta">미리보기</span>
              <YoutubeCard video={video} compact />
            </div>
          )}
          <div className="composer-foot">
            <button className="composer-photo" type="button" onClick={() => picker.current?.click()} disabled={photos.length >= POST_LIMITS.photosMax}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="10" r="1.8" />
                <path d="m21 16-5-5-8 8" />
              </svg>
              사진
            </button>
            <input
              ref={picker}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                addPhotos([...(event.target.files ?? [])]);
                event.target.value = '';
              }}
            />
            <span className="composer-count">{formatCount(body.length, POST_LIMITS.shortMax)}</span>
            <button className="tape" type="submit" disabled={busy || uploading}>
              {uploading ? '사진 올리는 중' : '올리기'}
            </button>
          </div>
        </div>
      </div>
      <FormStatus status={status} />
    </form>
  );
}
