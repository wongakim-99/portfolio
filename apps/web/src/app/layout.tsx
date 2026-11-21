import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { GuestTerminal } from '@widgets/guest-terminal';
import { portfolio } from '@entities/portfolio';
import '@shared/styles/tokens.css';
import '@shared/styles/base.css';

export const metadata: Metadata = {
  metadataBase: new URL(portfolio.siteUrl),
  title: { default: '김가원 | 홈', template: '%s | 김가원' },
  description: '국가 R&D 과제에서 서비스 API와 사용자 화면, AI 엔진 연동을 개발하는 Software Engineer 김가원의 포트폴리오',
  // 초안 단계라 검색 노출을 막아 둠. 내용 확정 후 이 줄 삭제
  robots: { index: false },
  openGraph: {
    type: 'website',
    url: '/',
    title: '김가원 | Software Engineer',
    description: 'AI 플랫폼의 화면부터 서버 연동까지 개발합니다.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// 저장해 둔 스탠드 상태를 그리기 전에 적용해 깜빡임을 막음 (features/theme-toggle 과 같은 'lamp' 값)
const LAMP_SCRIPT = `try{var l=JSON.parse(localStorage.getItem('lamp'));if(l==='off')document.documentElement.dataset.theme='dark';if(l==='on')document.documentElement.dataset.theme='light'}catch(e){}`;
const FONTS =
  'https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Nanum+Pen+Script&display=swap';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // 첫 스크립트가 data-theme 를 미리 붙이므로 서버 HTML 과 달라도 경고하지 않음
    // 목차 이동은 부드럽게 스크롤하되(base.css), 페이지를 옮길 때는 Next 가 바로 맨 위로 보냄
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LAMP_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* 한글 글꼴은 Google 이 글자 범위별로 잘라 내보내서 next/font 로 내려받지 않고 그대로 씀 */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <a className="skip" href="#main">
          본문 바로가기
        </a>
        {children}
        {/* 숨은 터미널은 페이지를 옮겨도 기록과 위치가 이어지도록 여기 하나만 둠 */}
        <GuestTerminal />
      </body>
    </html>
  );
}
