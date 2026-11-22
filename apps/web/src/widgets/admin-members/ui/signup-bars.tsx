'use client';

import { useState } from 'react';
import { formatNumber } from '@shared/lib';

/** 최근 날짜별 가입 수 막대. 한 계열이라 범례 없이 제목으로 이름을 붙이고, 막대에 올리면 그날 값을 위 줄에 씀 */
export function SignupBars({ days }: { days: { date: string; count: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const picked = active === null ? null : days[active];
  const short = (date?: string) => date?.slice(5).replace('-', '.');

  return (
    <figure className="members-chart">
      <figcaption>
        <span>최근 {days.length}일 가입</span>
        <span aria-live="polite">{picked ? `${short(picked.date)} ${formatNumber(picked.count)}명` : `합계 ${formatNumber(total)}명`}</span>
      </figcaption>
      <div
        className="members-bars"
        role="img"
        aria-label={`최근 ${days.length}일 날짜별 가입 수, 합계 ${total}명`}
        data-hover={active !== null || undefined}
        onPointerLeave={() => setActive(null)}
      >
        {days.map((day, index) => (
          // 칸 전체가 마우스 영역이라 막대가 낮거나 없어도 그날 값을 볼 수 있음
          <span
            key={day.date}
            className="members-bar-slot"
            title={`${day.date} 가입 ${day.count}명`}
            data-active={active === index || undefined}
            onPointerEnter={() => setActive(index)}
            onPointerDown={() => setActive(index)}
          >
            {day.count > 0 && <i style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }} />}
          </span>
        ))}
      </div>
      <div className="members-chart-axis" aria-hidden="true">
        <span>{short(days[0]?.date)}</span>
        <span>오늘</span>
      </div>
    </figure>
  );
}
