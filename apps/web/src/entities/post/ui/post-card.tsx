import Link from 'next/link';
import type { ReactNode } from 'react';
import { routes } from '@shared/config';
import { cx, formatAgo, formatDateTime } from '@shared/lib';
import { RichText, YoutubeCard } from '@shared/ui';
import type { Post, PostSummary } from '../model/types';
import './post-card.css';

interface PostCardProps {
  post: PostSummary | Post;
  /** 글쓴이 링크(사진과 이름). 계정 조각이라 화면 조립 쪽에서 넣음 */
  author: ReactNode;
  /** 좋아요, 답글 수 같은 아래 단추 줄 */
  actions?: ReactNode;
  /** 글 머리 오른쪽의 수정, 삭제, 신고 */
  menu?: ReactNode;
  /** 글 화면처럼 본문을 다 보이고 제목을 큰 머리로 씀 */
  full?: boolean;
}

/**
 * 쓰레드처럼 쌓이는 피드 글 한 장. 글쓴이와 지난 시간, 본문(링크는 새 탭), 사진, 유튜브 미리보기, 아래 단추 줄
 * 제목이 있는 긴 글은 목록에서 앞부분만 보이고 '더 읽기' 로 글 화면에 감
 */
export function PostCard({ post, author, actions, menu, full = false }: PostCardProps) {
  const href = routes.post(post.id);
  const text = 'body' in post ? post.body : post.excerpt;
  const truncated = 'truncated' in post && post.truncated;
  const Title = full ? 'h2' : 'h3';
  return (
    <article className={cx('feed-card', full && 'is-full')}>
      <header className="feed-card-head">
        {author}
        <Link className="feed-card-time" href={href} title={formatDateTime(post.createdAt)}>
          <time dateTime={post.createdAt}>{formatAgo(post.createdAt)}</time>
        </Link>
        {menu && <div className="feed-card-menu">{menu}</div>}
      </header>
      <div className="feed-card-body">
        {post.title && <Title className="feed-card-title">{full ? post.title : <Link href={href}>{post.title}</Link>}</Title>}
        {text && <RichText className="feed-card-text" text={truncated ? `${text}…` : text} />}
        {truncated && (
          <Link className="feed-card-more" href={href}>
            더 읽기
          </Link>
        )}
        {post.photos.length > 0 && (
          <div className="feed-card-photos" data-count={post.photos.length}>
            {post.photos.map((photo) => (
              <a key={photo.file} href={photo.url} target="_blank" rel="noopener noreferrer" aria-label="사진 크게 보기">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" loading="lazy" decoding="async" />
              </a>
            ))}
          </div>
        )}
        {post.video && <YoutubeCard video={post.video} />}
        {actions && <div className="feed-card-actions">{actions}</div>}
      </div>
    </article>
  );
}
