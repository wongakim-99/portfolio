import type { Metadata } from 'next';
import { AdminPage } from '@views/admin';

export const metadata: Metadata = { title: '관리실' };

export default function Page() {
  return <AdminPage />;
}
