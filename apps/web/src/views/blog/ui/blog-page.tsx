import { Sheet } from '@shared/ui';
import { BlogPostList } from '@widgets/blog-post-list';

/** 블로그 첫 화면. 위의 머리(글 쓰기)는 app/blog/layout.tsx 가 모든 블로그 화면에 같이 둠 */
export function BlogPage() {
  return (
    <Sheet clip className="community-sheet" aria-labelledby="blog-title">
      <div className="community-section-head">
        <h2 id="blog-title">최근 글</h2>
        <span className="community-meta">잠긴 글은 제목만 보입니다</span>
      </div>
      <BlogPostList />
    </Sheet>
  );
}
