/** 피드의 모든 화면 위에 늘 있는 머리. 글은 목록 맨 위 쓰기 칸에서 씀 */
export function FeedHeader() {
  return (
    <header className="community-header">
      <p className="hand community-hand">서로의 생각을 펼쳐 두는 곳</p>
      <h1>피드</h1>
      <p>짧은 생각, 사진, 유튜브 링크를 바로 남기고 답글로 이야기를 이어 가는 공간입니다. 글과 답글, 하트는 로그인한 뒤 남길 수 있어요.</p>
    </header>
  );
}
