import Link from 'next/link';
import { routes } from '@shared/config';
import './blog-post.css';

/** 글에 붙은 태그. 누르면 그 태그가 붙은 글만 모아 봄 */
export function TagList({ tags, className = 'blog-tags' }: { tags: string[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <ul className={className} aria-label="태그">
      {tags.map((tag) => (
        <li key={tag}>
          <Link className="blog-tag" href={routes.blogTag(tag)}>
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
