import type { Metadata } from 'next';
import { BlogEditorPage } from '@views/blog-editor';

export const metadata: Metadata = { title: '블로그 글 고치기' };

export default async function Page({ params }: PageProps<'/blog/posts/[postId]/edit'>) {
  const { postId } = await params;
  return <BlogEditorPage key={postId} postId={postId} />;
}
