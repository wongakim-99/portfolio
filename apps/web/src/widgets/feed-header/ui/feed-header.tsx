'use client';

import { useRouter } from 'next/navigation';
import { routes } from '@shared/config';
import { useSession } from '@entities/user';

/** 피드의 모든 화면 위에 늘 있는 머리. 짧은 글은 목록 맨 위 쓰기 칸에서, 제목 있는 긴 글은 여기서. 로그인 전이면 로그인 창부터 띄움 */
export function FeedHeader() {
  const router = useRouter();
  const { user, requestLogin } = useSession();

  return (
    <header className="community-header">
      <p className="hand community-hand">서로의 생각을 펼쳐 두는 곳</p>
      <h1>피드</h1>
      <p>짧은 생각, 사진, 유튜브 링크를 바로 남기고 답글로 이야기를 이어 가는 공간입니다. 글과 답글, 하트는 로그인한 뒤 남길 수 있어요.</p>
      <div className="community-toolbar">
        <button className="tape tape-lg" type="button" onClick={() => (user ? router.push(routes.write) : requestLogin(routes.write))}>
          긴 글 쓰기
        </button>
      </div>
    </header>
  );
}
