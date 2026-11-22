import Link from 'next/link';
import { routes } from '@shared/config';
import { formatDate } from '@shared/lib';
import type { BlogPostSummary } from '../model/types';
import { TagList } from './tag-list';
import { VisibilityStamp } from './visibility-stamp';
import './blog-post.css';

interface BlogCardProps {
  post: BlogPostSummary;
  /** 잠긴 글이면 앞부분 대신 보여 줄 한 줄 (그 글의 '증명하시면 볼 수 있습니다' 문제) */
  lockedNote: string;
}

/** 블로그 목록의 카드 한 장. 위에 썸네일, 제목 링크가 카드 전체를 덮고, 태그만 따로 눌림 */
export function BlogCard({ post, lockedNote }: BlogCardProps) {
  return (
    <article className="blog-card" data-locked={post.locked || undefined}>
      {post.cover && (
        <span className="blog-card-cover" aria-hidden="true">
          {/* 글 사진은 API 가 줄여 둔 파일이라 next/image 최적화를 거치지 않음 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.cover} alt="" loading="lazy" decoding="async" />
        </span>
      )}
      <p className="blog-card-meta">
        <span>{formatDate(post.createdAt)}</span>
        <VisibilityStamp visibility={post.visibility} locked={post.locked} />
      </p>
      <h3 className="blog-card-title">
        <Link href={routes.blogPost(post.id)}>{post.title}</Link>
      </h3>
      {post.excerpt === null ? <p className="blog-card-locked hand">{lockedNote}</p> : <p className="blog-card-excerpt">{post.excerpt}</p>}
      <TagList tags={post.tags} />
      <p className="blog-card-foot">
        <span>{post.readMinutes ? `${post.readMinutes}분 읽기` : '증명하거나 허락받으면 열림'}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </p>
    </article>
  );
}
