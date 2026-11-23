'use client';

import { useState } from 'react';
import { cx } from '@shared/lib';
import './youtube-card.css';

export interface YoutubeVideo {
  id: string;
  title: string | null;
  author: string | null;
  /** API 가 받아 둔 썸네일 주소 (/api/community/videos/<ID>/thumbnail) */
  thumbnail: string;
}

/**
 * 글 속 유튜브 링크의 미리보기. 썸네일은 우리 API 가 받아 둔 것을 쓰고, 누르기 전에는 유튜브에 아무 요청도 가지 않음
 * 누르면 그 자리에서 youtube-nocookie 로 재생. 유튜브는 퍼가기에 출처를 요구해서 이 iframe 만 출처를 보냄
 */
export function YoutubeCard({ video, compact = false }: { video: YoutubeVideo; compact?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const title = video.title ?? '유튜브 영상';
  const watch = `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <figure className={cx('yt-card', compact && 'is-compact')}>
      <div className="yt-card-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button className="yt-card-play" type="button" onClick={() => setPlaying(true)} aria-label={`${title} 재생`}>
            {!broken && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnail} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
            )}
            <span className="yt-card-tape" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7Z" />
              </svg>
              재생
            </span>
          </button>
        )}
      </div>
      <figcaption>
        <a href={watch} target="_blank" rel="noopener noreferrer nofollow">
          {title}
        </a>
        <span>{video.author ? `${video.author}, 유튜브` : '유튜브'}</span>
      </figcaption>
    </figure>
  );
}
