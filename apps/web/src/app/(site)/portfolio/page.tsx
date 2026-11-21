import type { Metadata } from 'next';
import { PortfolioPage } from '@views/portfolio';

export const metadata: Metadata = {
  title: '포트폴리오',
  description: '김가원의 경력, 프로젝트, 기술과 이력을 정리한 포트폴리오',
  openGraph: {
    type: 'website',
    url: '/portfolio',
    title: '포트폴리오 | 김가원',
    description: 'AI 플랫폼의 화면부터 서버 연동까지 개발합니다.',
  },
};

export default function Page() {
  return <PortfolioPage />;
}
