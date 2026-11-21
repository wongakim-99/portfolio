'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { formatDateTime } from '@shared/lib';
import type { Status } from '@shared/ui';
import {
  approveAccessRequest,
  listAccessGrants,
  listAccessRequests,
  rejectAccessRequest,
  revokeAccessGrant,
  type AccessGrant,
  type AccessRequest,
  type GrantScope,
} from '@entities/blog-access';
import { AuthorLink } from '@entities/user';
import './admin-blog-access.css';

interface AccessState {
  requests: AccessRequest[];
  grants: AccessGrant[];
  /** 불러오지 못했을 때 대신 보여 줄 글 */
  error: string | null;
  loaded: boolean;
}

/** 관리실의 블로그 열람 요청과 허락 명단. 권한(blog:grant)이 있을 때만 보임 */
export function AdminBlogAccess({ onStatus }: { onStatus: (status: Status) => void }) {
  const [state, setState] = useState<AccessState>({ requests: [], grants: [], error: null, loaded: false });
  const [busy, setBusy] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);

  const load = useCallback(
    () =>
      Promise.all([listAccessRequests(), listAccessGrants()]).then(
        ([{ requests }, { grants }]) => setState({ requests, grants, error: null, loaded: true }),
        (error) => setState((prev) => ({ ...prev, error: errorMessage(error), loaded: true })),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  // 블로그 머리의 '열람 요청'이나 알림 메일의 링크(#blog-requests)로 오면 목록을 받은 뒤 이 칸으로 내려감
  const { loaded } = state;
  useEffect(() => {
    if (loaded && location.hash === '#blog-requests') section.current?.scrollIntoView({ block: 'start' });
  }, [loaded]);

  async function act(id: string, task: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await task();
      await load();
      onStatus({ message: done, tone: 'ok' });
    } catch (error) {
      onStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  const approve = (item: AccessRequest, scope: GrantScope) =>
    act(
      item.id,
      () => approveAccessRequest(item.id, scope),
      scope === 'all' ? `${item.user.name}님이 이제 잠긴 글을 모두 읽습니다.` : `${item.user.name}님이 이제 '${item.post.title}' 글을 읽습니다.`,
    );
  const reject = (item: AccessRequest) => act(item.id, () => rejectAccessRequest(item.id), `${item.user.name}님의 요청을 거절했습니다. 3일 뒤에 다시 요청할 수 있습니다.`);
  const revoke = (grant: AccessGrant) => {
    if (!confirm(`${grant.user.name}님의 허락을 거둘까요? 다시 잠긴 글로 보입니다.`)) return;
    act(grant.id, () => revokeAccessGrant(grant.id), `${grant.user.name}님의 허락을 거뒀습니다.`);
  };

  const { requests, grants, error } = state;
  return (
    <>
      <section ref={section} className="admin-block" id="blog-requests" aria-labelledby="blog-requests-title">
        <div className="community-section-head">
          <h3 id="blog-requests-title">블로그 열람 요청</h3>
          <span className="community-meta">{loaded && !error ? (requests.length ? `기다리는 요청 ${requests.length}건` : '모두 답함') : ''}</span>
        </div>
        <div aria-live="polite">
          {error && <p className="community-empty">{error}</p>}
          {loaded && !error && !requests.length && <p className="community-empty">기다리는 요청이 없습니다. 다들 아직 증명 중인가 봅니다.</p>}
          {requests.map((item) => (
            <article className="access-card" key={item.id}>
              <p className="access-head">
                <AuthorLink authorId={item.user.id} authorName={item.user.name} authorAvatarUrl={item.user.avatarUrl} />
                님이 &lsquo;<Link href={routes.blogPost(item.post.id)}>{item.post.title}</Link>&rsquo; 글을 보고 싶어 합니다
              </p>
              {item.message && <p className="access-message">{item.message}</p>}
              <div className="access-foot">
                <span className="community-meta">{formatDateTime(item.createdAt)}</span>
                <div className="access-actions">
                  <button className="tape" type="button" disabled={busy === item.id} onClick={() => approve(item, 'post')}>
                    이 글만 허락
                  </button>
                  <button className="btn-line access-all" type="button" disabled={busy === item.id} onClick={() => approve(item, 'all')}>
                    잠긴 글 모두 허락
                  </button>
                  <button className="text-btn text-btn-danger" type="button" disabled={busy === item.id} onClick={() => reject(item)}>
                    거절
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-block" aria-labelledby="blog-grants-title">
        <div className="community-section-head">
          <h3 id="blog-grants-title">열람 허락 명단</h3>
          <span className="community-meta">{loaded && !error ? `${grants.length}건` : ''}</span>
        </div>
        {loaded && !error && !grants.length && <p className="community-empty">아직 허락한 사람이 없습니다.</p>}
        {grants.length > 0 && (
          <ul className="grant-list">
            {grants.map((grant) => (
              <li key={grant.id}>
                <AuthorLink authorId={grant.user.id} authorName={grant.user.name} authorAvatarUrl={grant.user.avatarUrl} />
                <span className="grant-what">
                  {grant.post ? <Link href={routes.blogPost(grant.post.id)}>{grant.post.title}</Link> : <b>잠긴 글 모두</b>}
                </span>
                <span className="community-meta">{formatDateTime(grant.createdAt)}</span>
                <button className="text-btn" type="button" disabled={busy === grant.id} onClick={() => revoke(grant)}>
                  허락 거두기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
