import type { Metadata } from 'next';
import { BlogEditorPage } from '@views/blog-editor';

export const metadata: Metadata = { title: '블로그 글 쓰기' };

export default function Page() {
  return <BlogEditorPage />;
}
