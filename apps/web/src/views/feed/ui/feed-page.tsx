import { Sheet } from '@shared/ui';
import { PostList } from '@widgets/post-list';

/** 피드 첫 화면. 위의 머리(글 쓰기)는 app/feed/layout.tsx 가 모든 피드 화면에 같이 둠 */
export function FeedPage() {
  return (
    <Sheet clip className="community-sheet" aria-labelledby="feed-title">
      <div className="community-section-head">
        <h2 id="feed-title">최근 글</h2>
        <span className="community-meta">모든 글은 공개됩니다</span>
      </div>
      <PostList
        loadingText="글을 불러오는 중입니다."
        emptyText="아직 글이 없습니다. 첫 글을 남겨 주세요."
        errorText="지금은 글을 불러오지 못합니다. 잠시 뒤에 다시 시도해 주세요."
        retry
      />
    </Sheet>
  );
}
