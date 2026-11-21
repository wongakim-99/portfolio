import { Suspense } from 'react';
import { BlogBoard } from './blog-board';
import './blog-page.css';

/** 블로그 첫 화면. 제목은 미리 그려 두고, 주소의 거르기(?tag=, ?q=)를 읽는 부분만 브라우저에서 그림 */
export function BlogPage() {
  return (
    <div className="blog-page">
      <header className="blog-hero">
        <p className="hand blog-hero-hand">혼잣말과 공부한 것 사이 어딘가</p>
        <h1>블로그</h1>
        <p>
          기술 글은 누구나 읽을 수 있어요. <mark>잠긴 글</mark>은 주인장이 허락한 분만 읽는데, 문제를 풀어도 열린다는 소문이 있습니다.
        </p>
      </header>
      <Suspense fallback={null}>
        <BlogBoard />
      </Suspense>
    </div>
  );
}
