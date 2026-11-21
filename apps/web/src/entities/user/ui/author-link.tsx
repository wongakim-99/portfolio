import Link from 'next/link';
import { routes } from '@shared/config';
import { Avatar } from './avatar';

interface AuthorLinkProps {
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
}

/** 글과 댓글의 글쓴이. 누르면 그 회원 페이지로 감 */
export function AuthorLink({ authorId, authorName, authorAvatarUrl }: AuthorLinkProps) {
  return (
    <Link className="community-author" href={routes.user(authorId)}>
      <Avatar person={{ id: authorId, name: authorName, avatarUrl: authorAvatarUrl ?? null }} />
      <span>{authorName}</span>
    </Link>
  );
}
