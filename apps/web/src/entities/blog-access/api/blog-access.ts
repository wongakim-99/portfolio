import { blogRequest } from '@shared/api';
import type { AccessGrant, AccessRequest, GrantScope } from '../model/types';

export const listAccessRequests = () => blogRequest<{ requests: AccessRequest[] }>('/admin/requests');
export const approveAccessRequest = (id: string, scope: GrantScope) =>
  blogRequest(`/admin/requests/${encodeURIComponent(id)}/approve`, { method: 'POST', body: { scope } });
export const rejectAccessRequest = (id: string) => blogRequest(`/admin/requests/${encodeURIComponent(id)}/reject`, { method: 'POST' });

export const listAccessGrants = () => blogRequest<{ grants: AccessGrant[] }>('/admin/grants');
export const revokeAccessGrant = (id: string) => blogRequest(`/admin/grants/${encodeURIComponent(id)}`, { method: 'DELETE' });
