'use client';

import { useEffect } from 'react';

// 피드 글이나 회원 페이지처럼 불러온 뒤에야 제목을 알 수 있는 화면에서 탭 제목을 바꿈
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
