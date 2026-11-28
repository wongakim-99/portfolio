import type { MetadataRoute } from 'next';

// 검색 엔진은 소개, 포트폴리오, 블로그, 피드 글을 읽어 가도 되고, 관리실과 글쓰기 화면, API 는 긁지 않게 함
// 막는 힘은 없는 약속이라 말 안 듣는 봇은 api 의 봇 방어(apps/api/src/modules/guard)와 Caddy 덫이 맡음
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/feed/admin', '/feed/write', '/blog/write', '/feed/posts/*/edit', '/blog/posts/*/edit'],
    },
  };
}
