'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { Dialog, FormStatus, NO_STATUS, type Status } from '@shared/ui';
import { resetPassword, useSession, verifyEmail } from '@entities/user';

// 가입 확인과 비밀번호 재설정 메일의 링크는 /feed#verify=<토큰>, /feed#reset=<토큰> 으로 옴
// 토큰은 # 뒤에 있어서 서버 로그에 남지 않고, 읽자마자 주소창에서 지움
function readMailLink() {
  if (typeof window === 'undefined') return { verify: null, reset: null };
  const link = new URLSearchParams(window.location.hash.slice(1));
  return { verify: link.get('verify'), reset: link.get('reset') };
}

export function MailLinkDialogs() {
  const { setUser } = useSession();
  // 서버에서 그릴 때는 비어 있고, 브라우저가 처음 그릴 때 주소의 # 를 읽음. 대화상자는 그린 뒤에 열려서 화면이 어긋나지 않음
  const [mailLink] = useState(readMailLink);
  const verifying = useRef(false);
  const [verifyOpen, setVerifyOpen] = useState(Boolean(mailLink.verify));
  const [verifyStatus, setVerifyStatus] = useState<Status>({ message: '확인하는 중입니다.' });
  const [resetToken, setResetToken] = useState(mailLink.reset);
  const [resetOpen, setResetOpen] = useState(Boolean(mailLink.reset));
  const [resetStatus, setResetStatus] = useState<Status>(NO_STATUS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { verify, reset } = mailLink;
    if (!verify && !reset) return;
    history.replaceState(null, '', location.pathname + location.search);
    // 확인 링크는 한 번만 쓸 수 있어서, 개발 모드에서 effect 가 두 번 돌아도 한 번만 보냄
    if (!verify || verifying.current) return;
    verifying.current = true;
    verifyEmail(verify).then(
      ({ user }) => {
        setUser(user);
        setVerifyStatus({ message: '이메일 확인을 마쳤습니다. 이제 글과 댓글을 남길 수 있어요.', tone: 'ok' });
      },
      (error) => setVerifyStatus({ message: errorMessage(error), tone: 'error' }),
    );
  }, [mailLink, setUser]);

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || !resetToken) return;
    setBusy(true);
    try {
      await resetPassword(resetToken, String(new FormData(form).get('newPassword')));
      setResetToken(null);
      // 비밀번호를 바꾸면 모든 로그인이 풀림
      setUser(null);
      form.reset();
      setResetStatus({ message: '비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.', tone: 'ok' });
    } catch (error) {
      setResetStatus({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={verifyOpen} onClose={() => setVerifyOpen(false)} className="community-dialog" labelledBy="verification-title">
        <div className="community-dialog-head">
          <h2 id="verification-title">이메일 확인</h2>
          <button className="text-btn" type="button" onClick={() => setVerifyOpen(false)}>
            닫기
          </button>
        </div>
        <FormStatus status={verifyStatus} />
      </Dialog>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} className="community-dialog" labelledBy="reset-title">
        <div className="community-dialog-head">
          <h2 id="reset-title">새 비밀번호</h2>
          <button className="text-btn" type="button" onClick={() => setResetOpen(false)}>
            닫기
          </button>
        </div>
        <form className="community-form" onSubmit={submitReset}>
          <label htmlFor="reset-password">
            새 비밀번호 <small>10자 이상</small>
          </label>
          <input id="reset-password" type="password" name="newPassword" required minLength={10} maxLength={128} autoComplete="new-password" />
          <button className="tape" type="submit" disabled={busy}>
            비밀번호 바꾸기
          </button>
        </form>
        <FormStatus status={resetStatus} />
      </Dialog>
    </>
  );
}
