'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { errorMessage } from '@shared/api';
import { routes } from '@shared/config';
import { logout, useSession } from '@entities/user';

// 상단 로그아웃 버튼과 내 페이지 계정 칸의 로그아웃이 같이 씀
// 로그인해야만 쓰는 화면(글쓰기, 글 수정, 관리실)에 있었으면 피드나 블로그 첫 화면으로 돌아감
export function useLogout() {
  const router = useRouter();
  const pathname = usePathname();
  const { setUser } = useSession();

  return useCallback(
    async (onError: (message: string) => void) => {
      try {
        await logout();
        setUser(null);
        const blog = pathname.startsWith(`${routes.blog}/`);
        if (pathname === routes.blogWrite || pathname === routes.admin || pathname.endsWith('/edit')) {
          router.push(blog ? routes.blog : routes.feed);
        }
      } catch (error) {
        onError(errorMessage(error));
      }
    },
    [pathname, router, setUser],
  );
}
