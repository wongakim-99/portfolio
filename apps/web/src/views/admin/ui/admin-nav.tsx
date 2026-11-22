import { cx } from '@shared/lib';

export interface AdminNavItem {
  key: string;
  label: string;
  /** 처리할 것이 있으면 빨간 숫자 */
  badge?: number;
}

interface AdminNavProps {
  items: AdminNavItem[];
  active: string;
  onSelect: (key: string) => void;
}

/** 관리실 칸 고르기. 넓은 화면에서는 종이 왼쪽의 사이드 패널, 좁으면 종이 위에 붙은 색인 탭 (admin-page.css) */
export function AdminNav({ items, active, onSelect }: AdminNavProps) {
  return (
    <nav className="admin-nav" aria-label="관리실 칸">
      <p className="hand admin-nav-hand">어디부터 볼까</p>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={`#${item.key}`}
              className={cx(item.key === active && 'is-active')}
              aria-current={item.key === active ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onSelect(item.key);
              }}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="admin-nav-badge" aria-label={`처리할 것 ${item.badge}건`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
