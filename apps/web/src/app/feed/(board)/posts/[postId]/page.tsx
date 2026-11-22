import { PostPage } from '@views/post';

export default async function Page({ params }: PageProps<'/feed/posts/[postId]'>) {
  const { postId } = await params;
  // 다른 글로 옮겨 가면 상태를 처음부터 다시 받도록 글마다 새로 그림
  return <PostPage key={postId} postId={postId} />;
}
