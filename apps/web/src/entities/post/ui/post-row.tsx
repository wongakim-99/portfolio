import Link from 'next/link';
import { routes } from '@shared/config';
import { formatDate } from '@shared/lib';
import type { ReactNode } from 'react';
import type { PostSummary } from '../model/types';
import './post-row.css';

/** author 칸에는 글쓴이 링크를 넣음. 회원 페이지의 '쓴 글' 목록처럼 글쓴이가 뻔하면 비워 둠 */
export function PostRow({ post, author }: { post: PostSummary; author?: ReactNode }) {
  return (
    <article className="community-post">
      <Link href={routes.post(post.id)}>{post.title}</Link>
      <p>{post.excerpt.length >= 220 ? `${post.excerpt}…` : post.excerpt}</p>
      <div className="community-meta">
        {author}
        <span>{formatDate(post.createdAt)}</span>
        <span>댓글 {post.commentCount}</span>
      </div>
    </article>
  );
}
