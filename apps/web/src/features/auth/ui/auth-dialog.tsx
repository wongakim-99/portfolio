'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage, errorStatus } from '@shared/api';
import { Dialog, FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { login, register, requestPasswordReset, resendVerification, useSession } from '@entities/user';

type Tab = 'login' | 'register' | 'forgot';
// 피드와 블로그가 같은 계정을 씀
const TITLE: Record<Tab, string> = { login: '로그인', register: '가입', forgot: '비밀번호 찾기' };

const fields = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));

// 피드, 블로그 로그인 창. 어디서든 useSession().requestLogin(next) 로 열고, 로그인하면 next 로 감
export function AuthDialog() {
  const router = useRouter();
  const { config, loginRequest, closeLogin, setUser } = useSession();
  const [tab, setTab] = useState<Tab>('login');
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [canResend, setCanResend] = useState(false);
  const [busy, setBusy] = useState(false);
  const loginForm = useRef<HTMLFormElement>(null);
  const loginEmail = useRef<HTMLInputElement>(null);
  const registerEmail = useRef<HTMLInputElement>(null);
  const resetEmail = useRef<HTMLInputElement>(null);
  const open = loginRequest !== null;
  const [wasOpen, setWasOpen] = useState(open);

  function switchTab(next: Tab) {
    setTab(next);
    setCanResend(false);
    setStatus(NO_STATUS);
  }

  // 열 때마다 로그인 탭부터
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) switchTab('login');
  }

  useEffect(() => {
    if (!open) return;
    ({ login: loginEmail, register: registerEmail, forgot: resetEmail })[tab].current?.focus();
  }, [open, tab]);

  async function run(form: HTMLFormElement, pending: string, task: () => Promise<void>) {
    if (!form.reportValidity()) return;
    setBusy(true);
    if (pending) setStatus({ message: pending });
    try {
      await task();
    } catch (error) {
      setStatus({ message: errorMessage(error), tone: 'error' });
      // 이메일 확인을 마치지 않은 계정이면 확인 메일을 다시 받을 수 있게 함
      setCanResend(errorStatus(error) === 403);
    } finally {
      setBusy(false);
    }
  }

  const onLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    run(form, '로그인하는 중입니다.', async () => {
      const { user } = await login(fields(form));
      const next = loginRequest?.next;
      setUser(user);
      closeLogin();
      form.reset();
      if (next) router.push(next);
    });
  };

  const onRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    run(form, '계정을 만드는 중입니다.', async () => {
      await register(fields(form));
      setStatus({ message: '가입할 수 있는 주소라면 확인 메일을 보냈습니다. 메일의 링크를 열어 가입을 완료해 주세요.', tone: 'ok' });
      form.reset();
    });
  };

  const onResetRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    run(form, '', async () => {
      await requestPasswordReset(fields(form));
      setStatus({ message: '등록된 주소라면 비밀번호 재설정 링크를 보냈습니다.', tone: 'ok' });
    });
  };

  const onResend = () => {
    const form = loginForm.current;
    if (!form) return;
    run(form, '', async () => {
      await resendVerification(fields(form));
      setStatus({ message: '가입한 주소라면 확인 메일을 다시 보냈습니다.', tone: 'ok' });
    });
  };

  return (
    <Dialog open={open} onClose={closeLogin} className="community-dialog" labelledBy="auth-title">
      <div className="community-dialog-head">
        <h2 id="auth-title">{TITLE[tab]}</h2>
        <button className="text-btn" type="button" onClick={closeLogin}>
          닫기
        </button>
      </div>
      <div className="community-tabs" role="tablist" aria-label="계정">
        <button type="button" role="tab" aria-selected={tab === 'login'} aria-controls="login-form" onClick={() => switchTab('login')}>
          로그인
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'register'}
          aria-controls="register-form"
          disabled={!config.registrationEnabled}
          onClick={() => switchTab('register')}
        >
          가입
        </button>
      </div>

      <form id="login-form" ref={loginForm} className="community-form" hidden={tab !== 'login'} onSubmit={onLogin}>
        <label htmlFor="login-email">이메일</label>
        <input ref={loginEmail} id="login-email" type="email" name="email" required autoComplete="email" />
        <label htmlFor="login-password">비밀번호</label>
        <input id="login-password" type="password" name="password" required autoComplete="current-password" />
        <button className="tape" type="submit" disabled={busy}>
          로그인
        </button>
        <div className="community-inline-actions">
          <button
            className="text-btn"
            type="button"
            onClick={() => {
              if (resetEmail.current && loginEmail.current) resetEmail.current.value = loginEmail.current.value;
              switchTab('forgot');
            }}
          >
            비밀번호 찾기
          </button>
          {canResend && (
            <button className="text-btn" type="button" onClick={onResend}>
              인증 메일 다시 받기
            </button>
          )}
        </div>
      </form>

      <form id="register-form" className="community-form" hidden={tab !== 'register'} onSubmit={onRegister}>
        <label htmlFor="register-email">이메일</label>
        <input ref={registerEmail} id="register-email" type="email" name="email" required maxLength={120} autoComplete="email" />
        <label htmlFor="register-name">표시 이름</label>
        <input id="register-name" name="name" required minLength={2} maxLength={30} autoComplete="nickname" />
        <label htmlFor="register-password">
          비밀번호 <small>10자 이상</small>
        </label>
        <input id="register-password" type="password" name="password" required minLength={10} maxLength={128} autoComplete="new-password" />
        <button className="tape" type="submit" disabled={busy}>
          계정 만들기
        </button>
      </form>

      <form className="community-form" hidden={tab !== 'forgot'} onSubmit={onResetRequest}>
        <label htmlFor="reset-request-email">가입한 이메일</label>
        <input ref={resetEmail} id="reset-request-email" type="email" name="email" required autoComplete="email" />
        <button className="tape" type="submit" disabled={busy}>
          재설정 링크 보내기
        </button>
      </form>

      {!config.registrationEnabled && <p className="community-meta">가입은 인증 메일 설정을 마친 뒤 열립니다.</p>}
      <FormStatus status={status} />
    </Dialog>
  );
}
