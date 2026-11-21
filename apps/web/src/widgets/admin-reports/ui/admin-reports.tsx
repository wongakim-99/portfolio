'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { formatDateTime } from '@shared/lib';
import type { Status } from '@shared/ui';
import { deleteCommentAsAdmin } from '@entities/comment';
import { deletePostAsAdmin } from '@entities/post';
import { dismissReport, listReports, REPORT_REASONS, type Report } from '@entities/report';
import { useSession } from '@entities/user';
import './admin-reports.css';

/** 피드 신고. 권한(reports:read)이 있을 때만 보임 */
export function AdminReports({ onStatus }: { onStatus: (status: Status) => void }) {
  const { can } = useSession();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      listReports().then(
        ({ reports: list }) => {
          setReports(list);
          setError(null);
        },
        (reason) => setError(errorMessage(reason)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function removeTarget(report: Report) {
    const kind = report.targetType === 'post' ? '글' : '댓글';
    if (!confirm(`신고된 ${kind}을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await (report.targetType === 'post' ? deletePostAsAdmin : deleteCommentAsAdmin)(report.targetId);
      onStatus({ message: `${kind}을 삭제했습니다.`, tone: 'ok' });
      await load();
    } catch (reason) {
      onStatus({ message: errorMessage(reason), tone: 'error' });
    }
  }

  async function dismiss(report: Report) {
    try {
      await dismissReport(report.id);
      setReports((list) => list?.filter((item) => item.id !== report.id) ?? null);
    } catch (reason) {
      onStatus({ message: errorMessage(reason), tone: 'error' });
    }
  }

  return (
    <section className="admin-block" aria-labelledby="reports-title">
      <div className="community-section-head">
        <h3 id="reports-title">신고</h3>
        <span className="community-meta">{reports?.length ? `${reports.length}건` : ''}</span>
      </div>
      <div aria-live="polite">
        {error && <p className="community-empty">{error}</p>}
        {!error && reports?.length === 0 && <p className="community-empty">처리할 신고가 없습니다.</p>}
        {!error &&
          reports?.map((report) => {
            const kind = report.targetType === 'post' ? '글' : '댓글';
            return (
              <article className="admin-report" key={report.id}>
                <p className="community-meta">
                  <span>{REPORT_REASONS[report.reason] ?? report.reason}</span>
                  <span>{kind}</span>
                  <span>{formatDateTime(report.createdAt)}</span>
                </p>
                <p className="admin-report-target">
                  {report.target ? (
                    <>
                      <Link href={routes.post(report.target.postId)}>{report.target.text}</Link>
                      <span> ({report.target.authorName})</span>
                    </>
                  ) : (
                    '이미 지워진 내용입니다.'
                  )}
                </p>
                <div className="community-inline-actions">
                  {report.target && can('content:moderate') && (
                    <button className="text-btn text-btn-danger" type="button" onClick={() => removeTarget(report)}>
                      {kind} 삭제
                    </button>
                  )}
                  {can('reports:dismiss') && (
                    <button className="text-btn" type="button" onClick={() => dismiss(report)}>
                      신고 닫기
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
