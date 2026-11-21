import { cx } from '@shared/lib';
import type { Entry } from '../model/content';
import { RichText } from './rich-text';
import './entry-card.css';

export function EntryCard({ entry }: { entry: Entry }) {
  return (
    <article className="entry">
      {entry.award && <span className="stamp">{entry.award}</span>}
      <header className="entry-head">
        <h3>{entry.title}</h3>
        <span className={cx('period', entry.live && 'is-live')}>{entry.period}</span>
      </header>
      {entry.role && <p className="role">{entry.role}</p>}
      {entry.desc && <p className="desc">{entry.desc}</p>}
      <ul className="points">
        {entry.points.map((point, index) => (
          <li key={index}>
            <RichText value={point} />
          </li>
        ))}
      </ul>
      <ul className="stack" aria-label="사용 기술">
        {entry.stack.map((tech) => (
          <li key={tech}>{tech}</li>
        ))}
      </ul>
      {entry.link && (
        <a className="code-link" href={entry.link} target="_blank" rel="noopener">
          코드 보기
        </a>
      )}
    </article>
  );
}
