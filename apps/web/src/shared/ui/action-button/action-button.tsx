import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@shared/lib';
import './action-button.css';

const ICONS = {
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  delete: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  report: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2 4 2 4H5" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M7 3v5h8V3" />
      <path d="M7 21v-7h10v7" />
    </>
  ),
} satisfies Record<string, ReactNode>;

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: keyof typeof ICONS;
  /** 삭제처럼 되돌릴 수 없는 일은 빨강 */
  tone?: 'danger';
  /** 댓글처럼 여러 개가 늘어서는 곳은 작게 */
  size?: 'md' | 'sm';
}

/** 글과 댓글의 수정, 삭제, 신고 버튼과 블로그 글쓰기의 임시저장 버튼 */
export function ActionButton({ icon, tone, size = 'md', className, children, type = 'button', ...rest }: ActionButtonProps) {
  return (
    <button type={type} className={cx('action-btn', tone === 'danger' && 'action-btn-danger', size === 'sm' && 'action-btn-sm', className)} {...rest}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {ICONS[icon]}
      </svg>
      {children}
    </button>
  );
}
