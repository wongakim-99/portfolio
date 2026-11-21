import type { Metadata } from 'next';
import { PostEditorPage } from '@views/post-editor';

export const metadata: Metadata = { title: '글 쓰기' };

export default function Page() {
  return <PostEditorPage />;
}
