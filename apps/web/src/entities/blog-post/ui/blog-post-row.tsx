import Link from 'next/link';
import { routes } from '@shared/config';
import { formatDate } from '@shared/lib';
import type { BlogPostSummary } from '../model/types';
import { VisibilityStamp } from './visibility-stamp';
import './blog-post.css';

/** 블로그 목록의 한 줄. 잠긴 글은 앞부분 대신 잠겼다는 한 줄 */
export function BlogPostRow({ post }: { post: BlogPostSummary }) {
  return (
    <article className="blog-row">
      <div className="blog-row-title">
        <Link href={routes.blogPost(post.id)}>{post.title}</Link>
        <VisibilityStamp visibility={post.visibility} locked={post.locked} />
      </div>
      {post.excerpt === null ? (
        <p className="blog-row-locked">주인장이 허락한 사람만 읽을 수 있는 글입니다. 열어 보면 다른 방법도 있긴 합니다.</p>
      ) : (
        <p>{post.excerpt.length >= 220 ? `${post.excerpt}…` : post.excerpt}</p>
      )}
      <div className="community-meta">
        <span>{formatDate(post.createdAt)}</span>
      </div>
    </article>
  );
}
