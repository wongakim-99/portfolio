import type { ReactNode } from 'react';
import { FeedHeader } from '@widgets/feed-header';

// 피드 목록, 글, 글쓰기, 회원 페이지 위에만 피드 머리를 둠. 관리실(/feed/admin)은 이 묶음 밖이라 머리 없이 뜸
export default function FeedBoardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FeedHeader />
      {children}
    </>
  );
}
