import Link from 'next/link';
import { routes } from '@shared/config';
import type { BlogRoomRef } from '../model/types';
import './blog-post.css';

/** 글이 든 방 이름표. 라벨 테이프처럼 붙어 있고, 누르면 그 방 글만 모아 봄 */
export function RoomLabel({ room }: { room: BlogRoomRef | null }) {
  if (!room) return null;
  return (
    <Link className="blog-room-label" href={routes.blogList({ room: room.id })} aria-label={`${room.name} 글 모아 보기`}>
      {room.name}
    </Link>
  );
}
