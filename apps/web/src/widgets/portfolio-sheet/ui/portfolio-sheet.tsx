import { Sheet } from '@shared/ui';
import { EntryCard, PORTFOLIO_PDF, portfolio } from '@entities/portfolio';
import './portfolio-sheet.css';

/** 목차와 숨은 터미널의 cd 가 이 id 로 찾아옴 */
export const PORTFOLIO_INDEX = [
  { id: 'about', label: '소개' },
  { id: 'work', label: '경력' },
  { id: 'projects', label: '프로젝트' },
  { id: 'skills', label: '기술' },
  { id: 'history', label: '이력' },
] as const;

// 출력한 포트폴리오 한 장. 같은 내용이 PDF 로도 나감 (scripts/portfolio-pdf.mjs)
export function PortfolioSheet() {
  return (
    <Sheet as="article" clip id="sheet">
      <a className="tape sheet-pdf" href={PORTFOLIO_PDF.href} download={PORTFOLIO_PDF.filename}>
        이 종이 PDF로 받기
      </a>

      <section className="block" id="about">
        <h2 className="block-title">소개</h2>
        <div className="about">
          {portfolio.about.map((item) => (
            <div className="about-item" key={item.label}>
              <h3 className="hand">{item.label}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="block" id="work">
        <h2 className="block-title">경력</h2>
        {portfolio.work.map((entry) => (
          <EntryCard key={entry.title} entry={entry} />
        ))}
      </section>

      <section className="block" id="projects">
        <h2 className="block-title">프로젝트</h2>
        {portfolio.projects.map((entry) => (
          <EntryCard key={entry.title} entry={entry} />
        ))}
      </section>

      <section className="block" id="skills">
        <h2 className="block-title">기술</h2>
        <div className="stickies">
          {portfolio.skills.map((group) => (
            <div className="sticky" key={group.label}>
              <h3 className="hand">{group.label}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="block" id="history">
        <h2 className="block-title">이력</h2>
        <ol className="timeline">
          {portfolio.history.map((item) => (
            <li key={`${item.when} ${item.what}`}>
              <span className="when">{item.when}</span>
              <span className="what">
                {item.what}
                {item.note && (
                  <>
                    {' '}
                    <span className="note">{item.note}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </Sheet>
  );
}
