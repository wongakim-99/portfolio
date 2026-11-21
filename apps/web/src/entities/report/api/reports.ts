import { communityRequest } from '@shared/api';
import type { Report, ReportReason, ReportTarget } from '../model/types';

export const createReport = (target: ReportTarget, reason: ReportReason) =>
  communityRequest('/reports', { method: 'POST', body: { ...target, reason } });

export const listReports = () => communityRequest<{ reports: Report[] }>('/admin/reports');
export const dismissReport = (id: string) => communityRequest(`/admin/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
