import type { CSSProperties } from 'react';
import type { Person } from '../model/types';
import './avatar.css';

// 사진이 없으면 포스트잇 색 위에 이름 첫 글자를 손글씨로 씀. 색은 회원 ID 로 정해서 사람마다 고정
export function Avatar({ person, className = 'avatar' }: { person: Person; className?: string }) {
  const sticky = ([...person.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4) + 1;
  return (
    <span className={className} aria-hidden="true" style={{ '--avatar-bg': `var(--sticky-${sticky})` } as CSSProperties}>
      {person.avatarUrl ? (
        // 사진은 API 가 내보내는 작은 정사각형이라 next/image 최적화를 거치지 않음
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        ([...person.name.trim()][0] ?? '?')
      )}
    </span>
  );
}
