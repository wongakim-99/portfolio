import Link from 'next/link';
import { routes } from '@shared/config';
import { formatStamp } from '@shared/lib';
import type { BlogPostSummary } from '@entities/blog-post';
import type { Thread } from '../lib/board';

/** 코르크판과 실 따라가기에 꽂는 메모 카드 한 장. 제목 링크가 카드 전체를 덮어 어디를 눌러도 글이 열림 */
export function BoardCard({ post, threads }: { post: BlogPostSummary; threads: Thread[] }) {
  return (
    <article className="thread-card-paper" data-locked={post.locked || undefined}>
      {post.cover && (
        <span className="thread-card-photo" aria-hidden="true">
          {/* 글 사진은 API 가 줄여 둔 파일이라 next/image 최적화를 거치지 않음 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.cover} alt="" loading="lazy" decoding="async" draggable={false} />
        </span>
      )}
      <p className="thread-card-meta">
        {post.room && <span className="thread-card-room">{post.room.name}</span>}
        {/* 카드가 좁아서 방 이름과 한 줄에 들도록 2026.11.21 처럼 짧게 */}
        <span>{formatStamp(post.createdAt).slice(0, 10)}</span>
      </p>
      <h3 className="thread-card-title">
        <Link href={routes.blogPost(post.id)} draggable={false} title={post.title}>
          {post.title}
        </Link>
      </h3>
      {post.excerpt && <p className="thread-card-excerpt">{post.excerpt}</p>}
      {post.locked && (
        <span className="thread-card-stamp" aria-label="잠긴 글">
          기밀
        </span>
      )}
      {post.tags.length > 0 && <p className="thread-card-tags">{post.tags.map((tag) => `#${tag}`).join(' ')}</p>}
      {threads.length > 0 && <span className="sr">이어진 실: {threads.map((thread) => thread.label).join(', ')}</span>}
    </article>
  );
}
