'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { useDocumentTitle } from '@shared/lib';
import { FormStatus, NO_STATUS, Sheet, type Status } from '@shared/ui';
import { AdminInbox } from '@widgets/admin-inbox';
import { AdminReports } from '@widgets/admin-reports';
import { ServerTopology } from '@widgets/server-topology';
import { useSession } from '@entities/user';
import './admin-page.css';

// 관리실. 칸마다 권한이 따로 있어서 가진 권한의 칸만 보임. 실제 허용 여부는 API 가 요청마다 다시 확인함
export function AdminPage() {
  const { user, ready, can, requestLogin } = useSession();
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const userId = user?.id;
  useDocumentTitle('관리실 | 김가원 피드');

  useEffect(() => {
    if (ready && !userId) requestLogin(routes.admin);
  }, [ready, userId, requestLogin]);

  const allowed = can('messages:read') || can('reports:read') || can('server:read');
  return (
    <Sheet className="community-sheet admin-sheet" aria-labelledby="admin-title">
      <Link className="community-back" href={routes.feed}>
        ← 모든 글
      </Link>
      <p className="hand profile-hand">운영자에게만 보이는 곳</p>
      <h2 id="admin-title">관리실</h2>
      <p className="community-meta admin-lead">
        {user && !allowed ? '관리자 권한이 있는 계정만 볼 수 있습니다.' : '지금 서버 상태와 홈 엽서로 받은 쪽지, 피드 신고를 봅니다.'}
      </p>
      {can('server:read') && <ServerTopology />}
      {can('messages:read') && <AdminInbox onStatus={setStatus} />}
      {can('reports:read') && <AdminReports onStatus={setStatus} />}
      <FormStatus status={status} />
    </Sheet>
  );
}
