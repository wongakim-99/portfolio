import { BlogPostPage } from '@views/blog-post';

export default async function Page({ params }: PageProps<'/blog/posts/[postId]'>) {
  const { postId } = await params;
  // 다른 글로 옮겨 가면 상태를 처음부터 다시 받도록 글마다 새로 그림
  return <BlogPostPage key={postId} postId={postId} />;
}
