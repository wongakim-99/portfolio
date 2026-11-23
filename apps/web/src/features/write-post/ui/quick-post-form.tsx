'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { formatCount, isImage, linkPreview, prepareImage, youtubeIdIn } from '@shared/lib';
import { FormStatus, LinkCard, NO_STATUS, YoutubeCard, type Status, type YoutubeVideo } from '@shared/ui';
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

// 주소 하나만 붙여 넣은 글자. 쓰기 칸에 붙이면 본문 대신 링크 칸으로 옮김
const LONE_URL = /^https?:\/\/\S+$/i;

/**
 * 피드 맨 위의 쓰기 칸. 500자까지, 사진 4장, 링크 하나. 링크는 본문과 따로 넣고(유튜브면 영상 카드, 아니면 링크 카드),
 * 올리기 전에 미리보기가 뜸. 올리면 onCreated 로 새 글을 넘겨 목록 맨 위에 바로 붙임
 */
export function QuickPostForm({ onCreated }: { onCreated: (post: Post) => void }) {
  const { user } = useSession();
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [link, setLink] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  /** 마지막으로 받은 유튜브 미리보기. 지금 글 속 링크와 같은 영상일 때만 보임 */
  const [preview, setPreview] = useState<YoutubeVideo | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const picker = useRef<HTMLInputElement>(null);
  // 링크 칸이 유튜브면 그 영상, 아니면 본문 속 첫 유튜브 링크를 미리 보여 줌
  const videoId = youtubeIdIn(link) ?? youtubeIdIn(body);
  const video = preview?.id === videoId ? preview : null;
  const linkCard = linkPreview(link);
  const badLink = Boolean(link.trim()) && !linkCard;
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
    if (badLink) return setStatus({ message: '링크는 http:// 나 https:// 로 시작하는 주소로 넣어 주세요.', tone: 'error' });
    if (!body.trim() && !photos.length && !linkCard) return setStatus({ message: '글, 사진, 링크 가운데 하나는 넣어 주세요.', tone: 'error' });
    setBusy(true);
    setStatus(NO_STATUS);
    try {
      const { post } = await createPost({ body, photos: photos.flatMap((photo) => (photo.file ? [photo.file] : [])), link: linkCard?.url });
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setBody('');
      setPhotos([]);
      setLink('');
      setLinkOpen(false);
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
              if (files.length) {
                event.preventDefault();
                addPhotos(files);
                return;
              }
              // 주소 하나만 붙이면 본문이 아니라 링크 칸으로 (링크 칸이 비어 있을 때만)
              const text = event.clipboardData.getData('text').trim();
              if (!link && LONE_URL.test(text)) {
                event.preventDefault();
                setLink(text);
                setLinkOpen(true);
              }
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
          {(linkOpen || link) && (
            <div className="composer-link">
              <label className="sr" htmlFor="composer-link">
                링크
              </label>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
              <input
                id="composer-link"
                type="url"
                inputMode="url"
                maxLength={POST_LIMITS.linkMax}
                placeholder="유튜브나 읽을거리 주소를 붙여 넣어 주세요"
                value={link}
                autoFocus={!link}
                aria-invalid={badLink || undefined}
                onChange={(event) => setLink(event.target.value)}
              />
              <button
                type="button"
                aria-label="링크 빼기"
                onClick={() => {
                  setLink('');
                  setLinkOpen(false);
                }}
              >
                ×
              </button>
            </div>
          )}
          {badLink && <p className="composer-hint">http:// 나 https:// 로 시작하는 주소를 넣어 주세요.</p>}
          {(video || linkCard) && (
            <div className="composer-video">
              <span className="community-meta">미리보기</span>
              {video ? <YoutubeCard video={video} compact /> : linkCard && <LinkCard link={linkCard} />}
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
            <button className="composer-photo" type="button" onClick={() => setLinkOpen(true)} disabled={linkOpen || Boolean(link)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
              링크
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
            <button className="tape" type="submit" disabled={busy || uploading || badLink}>
              {uploading ? '사진 올리는 중' : '올리기'}
            </button>
          </div>
        </div>
      </div>
      <FormStatus status={status} />
    </form>
  );
}
