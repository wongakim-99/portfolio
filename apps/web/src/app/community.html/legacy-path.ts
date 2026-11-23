import { routes } from '@shared/config';

// 정적 페이지 시절의 피드 주소(/community.html?post=...)를 지금 주소로 바꿈
// 메일 링크의 #verify=, #reset= 은 브라우저가 이동한 뒤에도 그대로 붙여 줌
export function legacyFeedPath(query: URLSearchParams) {
  const pick = (key: string) => query.get(key) || null;
  const post = pick('post');
  if (post) return routes.post(post);
  const user = pick('user');
  if (user) return routes.user(user);
  const edit = pick('edit');
  if (edit) return routes.editPost(edit);
  if (query.has('admin')) return routes.admin;
  return routes.feed;
}
