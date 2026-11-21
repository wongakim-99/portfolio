'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  className: string;
  labelledBy: string;
  children: ReactNode;
}

// 브라우저 기본 <dialog> 를 모달로 띄움. Esc, 바깥 클릭, 닫기 버튼 모두 onClose 로 모음
export function Dialog({ open, onClose, className, labelledBy, children }: DialogProps) {
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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
