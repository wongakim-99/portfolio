'use client';

import { useEffect, useRef, type ReactNode, type SyntheticEvent } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Esc 로 닫히기 직전. event.preventDefault() 하면 닫히지 않음 */
  onCancel?: (event: SyntheticEvent<HTMLDialogElement>) => void;
  className: string;
  labelledBy: string;
  children: ReactNode;
}

// 브라우저 기본 <dialog> 를 모달로 띄움. Esc, 바깥 클릭, 닫기 버튼 모두 onClose 로 모음
export function Dialog({ open, onClose, onCancel, className, labelledBy, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={onCancel}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
