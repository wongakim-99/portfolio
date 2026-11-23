import { permanentRedirect } from 'next/navigation';
import { routes } from '@shared/config';

// 긴 글 쓰기 화면은 없앴음. 글은 피드 맨 위 쓰기 칸에서 씀. 예전 주소로 와도 피드로 보냄
export default function Page() {
  permanentRedirect(routes.feed);
}
