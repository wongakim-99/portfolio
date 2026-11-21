import { PORTFOLIO_INDEX, PortfolioSheet } from '@widgets/portfolio-sheet';
import { SiteFooter } from '@widgets/site-footer';
import { displayUrl, portfolio } from '@entities/portfolio';
import './portfolio-page.css';

// 서버에서 다 그려 보내는 정적 페이지. 목차는 이 페이지 안에서만 이동함
export function PortfolioPage() {
  return (
    <>
      <main className="portfolio-main" id="main">
        <header className="portfolio-intro">
          <div>
            <h1>포트폴리오</h1>
            <p className="portfolio-owner">{portfolio.name}</p>
            <p className="portfolio-lead">{portfolio.lead}</p>
            <div className="portfolio-contact">
              <a href={`mailto:${portfolio.email}`}>{portfolio.email}</a>
              <a href={portfolio.github} target="_blank" rel="noopener">
                {displayUrl(portfolio.github)}
              </a>
            </div>
          </div>
          <nav className="portfolio-index" aria-label="포트폴리오 목차">
            <span>이 페이지에서</span>
            {PORTFOLIO_INDEX.map(({ id, label }) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
        </header>
        <PortfolioSheet />
      </main>
      <SiteFooter />
    </>
  );
}
