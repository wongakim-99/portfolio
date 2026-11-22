import Link from 'next/link';
import { routes } from '@shared/config';
import { formatDate } from '@shared/lib';
import { redactedLines } from '../lib/redaction';
import type { BlogPostSummary } from '../model/types';
import { TagList } from './tag-list';
import { VisibilityStamp } from './visibility-stamp';
import './blog-post.css';

// 잠긴 글은 본문 자리를 기밀 문서처럼 줄로 지움. 문제(증명하면 열림)는 글을 열어야 나와서 목록에서 농담이 새지 않음
function Redacted({ seed }: { seed: string }) {
  return (
    <div className="blog-card-redacted">
      <p className="sr">잠긴 글이라 본문 앞부분은 가려져 있습니다.</p>
      {redactedLines(seed).map((bars, line) => (
        <span key={line} className="blog-card-redacted-line" aria-hidden="true">
          {bars.map((width, index) => (
            <span key={index} style={{ width: `${width}%` }} />
          ))}
        </span>
      ))}
    </div>
  );
}

/** 블로그 목록의 카드 한 장. 위에 썸네일, 제목 링크가 카드 전체를 덮고, 태그만 따로 눌림 */
export function BlogCard({ post }: { post: BlogPostSummary }) {
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
      {post.excerpt === null ? <Redacted seed={post.id} /> : <p className="blog-card-excerpt">{post.excerpt}</p>}
      <TagList tags={post.tags} />
      <p className="blog-card-foot">
        {post.locked ? (
          // 마우스를 올리면 '열어 보기' 가 빨간 펜 한마디로 바뀜
          <span className="blog-card-foot-label">
            <span>열어 보기</span>
            <span className="blog-card-whisper hand" aria-hidden="true">
              풀 수 있으면 열릴지도...?
            </span>
          </span>
        ) : (
          <span>{post.readMinutes ? `${post.readMinutes}분 읽기` : ''}</span>
        )}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </p>
    </article>
  );
}
