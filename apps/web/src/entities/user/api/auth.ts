import { communityRequest } from '@shared/api';
import type { AuthConfig, SessionUser } from '../model/types';

type UserResult = { user: SessionUser };
type Fields = Record<string, FormDataEntryValue>;

export const getAuthConfig = () => communityRequest<AuthConfig>('/auth/config');
export const getMe = () => communityRequest<{ user: SessionUser | null }>('/auth/me');

export const login = (body: Fields) => communityRequest<UserResult>('/auth/login', { method: 'POST', body });
export const register = (body: Fields) => communityRequest('/auth/register', { method: 'POST', body });
export const logout = () => communityRequest('/auth/logout', { method: 'POST' });
export const resendVerification = (body: Fields) => communityRequest('/auth/resend', { method: 'POST', body });

/** 가입 확인 메일의 링크. 확인되면 바로 로그인됨 */
export const verifyEmail = (token: string) => communityRequest<UserResult>('/auth/verify', { method: 'POST', body: { token } });

export const requestPasswordReset = (body: Fields) => communityRequest('/auth/reset-request', { method: 'POST', body });
export const resetPassword = (token: string, newPassword: string) =>
  communityRequest('/auth/reset', { method: 'POST', body: { token, newPassword } });
export const changePassword = (body: Fields) => communityRequest('/auth/password', { method: 'POST', body });
