'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { routes } from '@shared/config';
import { formatNumber } from '@shared/lib';
import { DeployReceipt } from '@widgets/deploy-receipt';
import { Laptop } from '@widgets/laptop';
import { SiteFooter } from '@widgets/site-footer';
import { CopyEmail } from '@features/copy-email';
import { HighFive } from '@features/high-five';
import { PostcardForm } from '@features/send-postcard';
import { useRecentDeploys } from '@entities/deploy';
import { displayUrl, PORTFOLIO_PDF, portfolio } from '@entities/portfolio';
import { useServerStatus } from '@entities/server-status';
import { useVisitCount } from '@entities/visit';
import './home-page.css';

// 예전 한 장짜리 홈의 /#about 같은 링크는 포트폴리오 페이지의 그 섹션으로 보냄
const LEGACY_PORTFOLIO_HASHES = new Set(['sheet', 'about', 'work', 'projects', 'skills', 'history']);

export function HomePage() {
  // 서버 상태는 노트북과 영수증이 같이 씀. 숨은 터미널은 상단 버튼으로 어느 페이지에서든 열림 (app/layout.tsx)
  const server = useServerStatus();
  const visits = useVisitCount();
  const deploys = useRecentDeploys(5);

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (LEGACY_PORTFOLIO_HASHES.has(hash)) location.replace(`${routes.portfolio}#${hash}`);
  }, []);

  return (
    <>
      <main className="home-main" id="main">
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="hand hero-hello">안녕하세요, 저는</p>
            <h1 className="hero-name">{portfolio.name}</h1>
            <p className="hero-lead">{portfolio.lead}</p>
            <ul className="hero-contact">
              <li>
                <CopyEmail email={portfolio.email} />
              </li>
              <li>
                <a href={portfolio.github} target="_blank" rel="noopener">
                  {displayUrl(portfolio.github)}
                </a>
              </li>
            </ul>
            <div className="hero-actions">
              <Link className="tape tape-lg" href={routes.portfolio}>
                포트폴리오 보기
              </Link>
              <Link className="btn-line" href={routes.feed}>
                피드 읽기
              </Link>
              <a className="home-pdf" href={PORTFOLIO_PDF.href} download={PORTFOLIO_PDF.filename}>
                PDF 받기
              </a>
            </div>
          </div>
          <Laptop server={server} />
        </section>

        <nav className="home-paths" aria-label="사이트 둘러보기">
          <Link className="home-path home-path-portfolio" href={routes.portfolio}>
            <span className="home-path-tab">포트폴리오</span>
            <strong>만든 것과 일한 기록</strong>
            <span>경력, 프로젝트, 기술과 이력을 한 장의 종이처럼 펼쳐 두었습니다.</span>
            <span className="home-path-action">포트폴리오 열기</span>
          </Link>
          <Link className="home-path home-path-feed" href={routes.feed}>
            <span className="home-path-tab">피드</span>
            <strong>생각을 나누는 공간</strong>
            <span>긴 글을 읽고, 로그인해서 게시글과 댓글을 남길 수 있습니다.</span>
            <span className="home-path-action">피드 들어가기</span>
          </Link>
        </nav>

        <div className="desk-row">
          <section className="server" id="server" aria-labelledby="server-title">
            <h2 className="desk-title" id="server-title">
              이 페이지가 도는 곳
            </h2>
            <p className="desk-lead">집에 있는 노트북 한 대에서 돌아갑니다. 영수증 숫자는 10초마다 실제 서버 값으로 바뀌어요.</p>
            <DeployReceipt server={server} visits={visits} deploys={deploys} />
          </section>

          <section className="mail" id="note" aria-labelledby="note-title">
            <h2 className="desk-title" id="note-title">
              쪽지 남기기
            </h2>
            <p className="desk-lead">궁금한 점이나 제안을 적어 주세요. 메일을 남기시면 답장 드릴게요.</p>
            <PostcardForm />
            <HighFive />
          </section>
        </div>
      </main>

      <SiteFooter note={visits === null ? null : ` / 방문 ${formatNumber(visits)}`} homeLink={false} />
    </>
  );
}
