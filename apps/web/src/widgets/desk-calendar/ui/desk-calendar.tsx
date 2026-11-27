'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { routes } from '@shared/config';
import { cx } from '@shared/lib';
import { getBlogCalendar, type CalendarDay } from '@entities/blog-post';
import { useSession } from '@entities/user';
import { dayLabel, formatWritingTime, inkLevel, monthWeeks, seoulToday, shiftMonth, WEEKDAYS } from '../lib/calendar';
import './desk-calendar.css';

// 블로그 첫 화면 책상 위에 세워 둔 탁상 달력. GitHub 잔디의 책상 판
// 글을 쓴 날에는 쓴 시간만큼 진한 커피 자국, 글을 올린 날에는 빨간 도장. 날짜를 누르거나 올리면 아래 쪽지에 그날 이야기

// 오늘은 서버와 처음 그릴 때 null 이라 서버 HTML 과 어긋나지 않고, 화면을 붙인 뒤에 서울 날짜로 채워짐
const noSubscribe = () => () => {};
const useToday = () => useSyncExternalStore(noSubscribe, () => seoulToday(), () => null);

// 날짜마다 커피 자국이 조금씩 다른 자리, 다른 각도로 찍히게 (날짜로 정해 늘 같음)
const stainStyle = (day: string) => {
  const date = Number(day.slice(8));
  return { '--turn': `${(date * 47) % 360}deg`, '--dx': `${((date * 13) % 5) - 2}px`, '--dy': `${((date * 7) % 5) - 2}px` } as CSSProperties;
};

interface MonthData {
  month: string;
  days: Map<string, CalendarDay>;
  failed: boolean;
}

export function DeskCalendar() {
  const { user, ready } = useSession();
  const userId = user?.id ?? null;
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<MonthData | null>(null);
  const month = picked ?? today?.slice(0, 7) ?? null;

  // 로그인이 바뀌면 나만 보기 글 도장이 달라져 다시 받음
  useEffect(() => {
    if (!ready || !month) return;
    let active = true;
    getBlogCalendar(month).then(
      (calendar) => active && setData({ month, days: new Map(calendar.days.map((day) => [day.day, day])), failed: false }),
      () => active && setData({ month, days: new Map(), failed: true }),
    );
    return () => {
      active = false;
    };
  }, [ready, userId, month]);

  if (!month || !today) return <aside className="desk-calendar is-waiting" aria-hidden="true" />;

  const current = data?.month === month ? data : null;
  const days = current?.days ?? new Map<string, CalendarDay>();
  const thisMonth = month === today.slice(0, 7);
  // 쪽지에 띄울 날: 고른 날, 없으면 이번 달은 오늘, 지난달은 마지막으로 무언가 있던 날
  const shown = selected?.startsWith(month) ? selected : thisMonth ? today : [...days.keys()].pop() ?? null;
  const shownDay = shown ? days.get(shown) : undefined;
  // 쪽지는 네 줄 높이로 고정해 날짜를 옮겨 다녀도 달력 키가 그대로. 글이 많으면 두 편과 나머지 수만
  const shownPosts = shownDay?.posts ?? [];
  const notePosts = shownPosts.length > 3 ? shownPosts.slice(0, 2) : shownPosts;
  const morePosts = shownPosts.length - notePosts.length;
  const written = [...days.values()].filter((day) => day.minutes > 0);
  const totalMinutes = written.reduce((sum, day) => sum + day.minutes, 0);
  const totalPosts = [...days.values()].reduce((sum, day) => sum + day.posts.length, 0);
  const when = thisMonth ? '이번 달' : `${Number(month.slice(5))}월에는`;
  const summary = totalMinutes
    ? `${when} ${written.length}일 동안 ${formatWritingTime(totalMinutes)} 썼어요`
    : totalPosts
      ? `${when} 글 ${totalPosts}편을 올렸어요`
      : `${when} 아직 빈 달이에요`;

  const describe = (day: string) => {
    const info = days.get(day);
    const parts = [dayLabel(day)];
    if (info?.minutes) parts.push(`${formatWritingTime(info.minutes)} 씀`);
    if (info?.posts.length) parts.push(`글 ${info.posts.length}편 올림`);
    return parts.join(', ');
  };

  return (
    <aside className="desk-calendar" aria-label="책상 달력">
      <span className="desk-calendar-rings" aria-hidden="true" />
      <header className="desk-calendar-head">
        <button type="button" className="desk-calendar-flip" aria-label="지난달" onClick={() => setPicked(shiftMonth(month, -1))}>
          ‹
        </button>
        <h2>
          <small>{month.slice(0, 4)}</small>
          {Number(month.slice(5))}월
        </h2>
        <button type="button" className="desk-calendar-flip" aria-label="다음 달" disabled={thisMonth} onClick={() => setPicked(shiftMonth(month, 1))}>
          ›
        </button>
      </header>
      <table className="desk-calendar-grid">
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th key={weekday} scope="col">
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={!current}>
          {monthWeeks(month).map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) return <td key={`blank-${j}`} />;
                const info = days.get(day);
                const level = inkLevel(info?.minutes ?? 0);
                const future = day > today;
                return (
                  <td key={day}>
                    <button
                      type="button"
                      className={cx('desk-day', day === today && 'is-today', day === shown && 'is-shown')}
                      aria-label={describe(day)}
                      aria-pressed={day === shown}
                      disabled={future}
                      onClick={() => setSelected(day)}
                      onMouseEnter={() => setSelected(day)}
                    >
                      {level > 0 && <span className={`desk-coffee is-${level}`} style={stainStyle(day)} aria-hidden="true" />}
                      <span className="desk-day-num">{Number(day.slice(8))}</span>
                      {info?.posts.length ? (
                        <span className="desk-stamp" aria-hidden="true">
                          {info.posts.length > 1 ? `${info.posts.length}편` : '글'}
                        </span>
                      ) : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="desk-note" aria-live="polite">
        {current?.failed ? (
          <p>지금은 달력을 불러오지 못했어요.</p>
        ) : shown ? (
          <>
            <p className="desk-note-head">
              <b>{dayLabel(shown)}</b>
              {shownDay?.minutes ? <span>{formatWritingTime(shownDay.minutes)} 씀</span> : null}
            </p>
            {notePosts.map((post) => (
              <Link key={post.id} href={routes.blogPost(post.id)}>
                {post.title}
              </Link>
            ))}
            {morePosts > 0 && <p>그 밖에 {morePosts}편을 더 올렸어요.</p>}
            {!notePosts.length && (
              <p>{shownDay?.minutes ? '올린 글은 없어요.' : shown === today ? '오늘은 아직 책상이 비어 있어요.' : '책상이 비어 있었어요.'}</p>
            )}
          </>
        ) : (
          <p>날짜를 눌러 보세요.</p>
        )}
      </div>
      <p className="hand desk-calendar-sum">{summary}</p>
    </aside>
  );
}
