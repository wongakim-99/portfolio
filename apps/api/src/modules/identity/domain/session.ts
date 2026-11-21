// 로그인과 메일 링크의 유효 시간
export const SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const VERIFY_AGE_MS = 60 * 60 * 1000;
export const RESET_AGE_MS = 30 * 60 * 1000;
/** 가입 확인을 마치지 않은 계정을 남겨 두는 시간 */
export const PENDING_AGE_MS = 24 * 60 * 60_000;
/** 확인 메일, 재설정 메일을 다시 보내기 전에 기다리는 시간 */
export const MAIL_RESEND_GAP_MS = 10 * 60_000;

export type MailTokenKind = 'verify' | 'reset';
