import type { Metadata } from 'next';
import { PostEditorPage } from '@views/post-editor';

export const metadata: Metadata = { title: '글 수정' };

export default async function Page({ params }: PageProps<'/feed/posts/[postId]/edit'>) {
  const { postId } = await params;
  return <PostEditorPage key={postId} postId={postId} />;
}
