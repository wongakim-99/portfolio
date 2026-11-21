'use client';

import { useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { Dialog, FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { createReport, REPORT_REASONS, type ReportReason, type ReportTarget } from '@entities/report';

/** target 이 있으면 열림. 신고 내역은 관리실에서 처리함 */
export function ReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [shown, setShown] = useState(target);
  // 다른 글이나 댓글을 신고하러 열면 지난 안내를 지움
  if (target !== shown) {
    setShown(target);
    setStatus(NO_STATUS);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    try {
      await createReport(target, new FormData(event.currentTarget).get('reason') as ReportReason);
      setStatus({ message: '신고를 접수했습니다.', tone: 'ok' });
    } catch (error) {
      setStatus({ message: errorMessage(error), tone: 'error' });
    }
  }

  return (
    <Dialog open={target !== null} onClose={onClose} className="community-dialog" labelledBy="report-title">
      <div className="community-dialog-head">
        <h2 id="report-title">신고하기</h2>
        <button className="text-btn" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
      <form className="community-form" onSubmit={submit}>
        <label htmlFor="report-reason">사유</label>
        <select id="report-reason" name="reason">
          {Object.entries(REPORT_REASONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="tape" type="submit">
          신고 보내기
        </button>
      </form>
      <FormStatus status={status} />
    </Dialog>
  );
}
