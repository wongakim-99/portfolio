import { cx } from '@shared/lib';

export type StatusTone = '' | 'ok' | 'error';
export interface Status {
  message: string;
  tone?: StatusTone;
}
export const NO_STATUS: Status = { message: '' };

// 폼 아래 한 줄 안내. 읽기 프로그램이 바뀐 문구를 바로 읽어 주도록 role=status 를 둠
export function FormStatus({ status, className }: { status: Status; className?: string }) {
  return (
    <p className={cx('form-status', className)} role="status" aria-live="polite" data-state={status.tone ?? ''}>
      {status.message}
    </p>
  );
}
