'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { getAuthConfig, getMe } from '../api/auth';
import type { AuthConfig, Permission, SessionUser } from './types';

interface SessionValue {
  user: SessionUser | null;
  setUser: Dispatch<SetStateAction<SessionUser | null>>;
  /** 첫 로그인 확인(/auth/me)이 끝났는지. 로그인이 필요한 화면은 이걸 보고 로그인 창을 띄움 */
  ready: boolean;
  config: AuthConfig;
  /** 버튼을 보이거나 숨기는 데만 씀. 실제 허용 여부는 서버가 요청마다 역할로 다시 확인함 */
  can: (permission: Permission) => boolean;
  /** 로그인 창 요청. next 가 있으면 로그인한 뒤 그 주소로 감 */
  loginRequest: { next: string | null } | null;
  requestLogin: (next?: string) => void;
  closeLogin: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

// 피드 화면(/feed/*)이 같이 쓰는 로그인 상태. app/feed/layout.tsx 가 감쌈
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<AuthConfig>({ registrationEnabled: false, uploadsEnabled: false });
  const [loginRequest, setLoginRequest] = useState<SessionValue['loginRequest']>(null);

  useEffect(() => {
    let active = true;
    getAuthConfig().then(
      (value) => active && setConfig({ registrationEnabled: Boolean(value.registrationEnabled), uploadsEnabled: Boolean(value.uploadsEnabled) }),
      () => {},
    );
    // 메일 링크로 들어와 먼저 로그인됐으면 그 결과를 덮어쓰지 않음
    getMe()
      .then(
        ({ user: me }) => active && setUser((prev) => prev ?? me),
        () => {},
      )
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  const can = useCallback((permission: Permission) => Boolean(user?.permissions.includes(permission)), [user]);
  const requestLogin = useCallback((next?: string) => setLoginRequest({ next: next ?? null }), []);
  const closeLogin = useCallback(() => setLoginRequest(null), []);

  const value = useMemo(
    () => ({ user, setUser, ready, config, can, loginRequest, requestLogin, closeLogin }),
    [user, ready, config, can, loginRequest, requestLogin, closeLogin],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession 은 SessionProvider 안에서만 씀');
  return session;
}
