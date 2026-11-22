'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@shared/api';
import { cx, formatNumber } from '@shared/lib';
import { Avatar, listMembers, type Member } from '@entities/user';
import { dailySignups, filterMembers, formatAgo, rosterCounts, seoulDate, type MemberFilter } from '../lib/roster';
import { MemberDialog } from './member-dialog';
import { MemberStamps } from './member-stamps';
import { SignupBars } from './signup-bars';
import './admin-members.css';

const SIGNUP_DAYS = 30;

/** 관리실 회원 칸: 몇 명이 가입했고 누가 있는지. 권한(members:read)이 있을 때만 보임 */
export function AdminMembers() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      listMembers().then(
        (result) => {
          setMembers(result.members);
          setLimited(result.limited);
          setError(null);
        },
        (reason) => setError(errorMessage(reason)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const all = useMemo(() => members ?? [], [members]);
  const counts = useMemo(() => rosterCounts(all), [all]);
  const days = useMemo(() => dailySignups(all, SIGNUP_DAYS), [all]);
  const shown = useMemo(() => filterMembers(all, query, filter), [all, query, filter]);
  const selected = all.find((member) => member.id === openId) ?? null;

  const filters: { key: MemberFilter; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: all.length },
    { key: 'staff', label: '운영진', count: counts.staff },
    { key: 'pending', label: '확인 대기', count: counts.pending },
  ];

  function replace(changed: Member) {
    setMembers((list) => list?.map((member) => (member.id === changed.id ? changed : member)) ?? null);
  }

  return (
    <section className="admin-block" aria-labelledby="members-title">
      <div className="community-section-head">
        <h3 id="members-title">회원</h3>
        <span className="community-meta">{limited ? '최근 가입 1000명까지' : members ? `${formatNumber(all.length)}명` : ''}</span>
      </div>
      {error && <p className="community-empty">{error}</p>}
      {!error && !members && <p className="community-empty">회원 명부를 펼치는 중입니다.</p>}
      {members && (
        <>
          <dl className="members-stats">
            <div>
              <dt>회원</dt>
              <dd>{formatNumber(counts.verified)}</dd>
              <span>가입 확인을 마친 계정</span>
            </div>
            <div>
              <dt>최근 7일 가입</dt>
              <dd>{formatNumber(counts.lastWeek)}</dd>
              <span>확인 대기 포함</span>
            </div>
            <div>
              <dt>확인 대기</dt>
              <dd>{formatNumber(counts.pending)}</dd>
              <span>하루 안에 확인하지 않으면 지워짐</span>
            </div>
            <div>
              <dt>운영진</dt>
              <dd>{formatNumber(counts.staff)}</dd>
              <span>주인장과 관리자</span>
            </div>
          </dl>

          <SignupBars days={days} />

          <div className="members-tools">
            <input
              type="search"
              aria-label="회원 찾기"
              placeholder="이름이나 이메일로 찾기"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="members-chips" role="group" aria-label="회원 분류">
              {filters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={cx('members-chip', filter === item.key && 'is-active')}
                  aria-pressed={filter === item.key}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label} <span>{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="community-empty">{all.length ? '찾는 회원이 없습니다.' : '아직 가입한 사람이 없습니다.'}</p>
          ) : (
            <ul className="members-list">
              {shown.map((member) => (
                <li key={member.id}>
                  <button type="button" className="members-row" onClick={() => setOpenId(member.id)}>
                    <Avatar person={member} className="avatar members-avatar" />
                    <span className="members-who">
                      <span className="members-name">
                        <b>{member.name}</b>
                        <MemberStamps member={member} />
                      </span>
                      <span className="members-email">{member.email}</span>
                    </span>
                    <span className="members-when members-joined">
                      <small>가입</small>
                      {seoulDate(member.createdAt).replaceAll('-', '.')}
                    </span>
                    <span className="members-when members-seen">
                      <small>마지막 로그인</small>
                      {member.lastLoginAt ? formatAgo(member.lastLoginAt) : '기록 없음'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {selected && <MemberDialog member={selected} onClose={() => setOpenId(null)} onChanged={replace} />}
    </section>
  );
}
