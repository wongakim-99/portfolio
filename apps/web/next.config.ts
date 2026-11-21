import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// npm 워크스페이스 루트. 의존성이 루트 node_modules 에 모여 있어서 빌드와 standalone 추적을 여기서 시작함
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
// 로컬 개발에서 /api 를 넘겨 줄 API 주소 (npm run dev 가 3000 에 띄움)
const devApiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';

const nextConfig: NextConfig = {
  // 홈서버 web 컨테이너는 .next/standalone 의 server.js 만 실행함 (apps/web/Dockerfile)
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  poweredByHeader: false,
  // 운영에서는 앞단 Caddy 가 zstd, gzip 으로 압축함
  compress: false,
  reactStrictMode: true,
  devIndicators: false,
  // 로컬 개발 페이지를 127.0.0.1 로 열어도 개발 서버가 스크립트 요청을 막지 않게 함
  allowedDevOrigins: ['127.0.0.1'],
  async redirects() {
    // 정적 페이지 시절 주소. 피드(community.html)는 쿼리를 보고 나눠야 해서 app/community.html/route.ts 가 맡음
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/portfolio.html', destination: '/portfolio', permanent: true },
    ];
  },
  async rewrites() {
    // 운영에서는 Caddy 가 /api 를 api 컨테이너로 바로 보내므로 Next 까지 오지 않음
    if (process.env.NODE_ENV === 'production') return [];
    return [{ source: '/api/:path*', destination: `${devApiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
