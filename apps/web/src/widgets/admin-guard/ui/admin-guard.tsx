'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@shared/api';
import { cx, formatDateTime } from '@shared/lib';
import type { Status } from '@shared/ui';
import { getGuardOverview, GUARD_LABEL, liftGuardBan, type GuardBan, type GuardKind, type GuardOverview } from '@entities/guard';
import './admin-guard.css';

const SHOWN_EVENTS = 20;
const clock = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** 관리실 '이상 징후'. 봇 방어가 센 것과 자동으로 막은 주소. 권한(server:read)이 있을 때만 보임 */
export function AdminGuard({ onStatus }: { onStatus: (status: Status) => void }) {
  const [data, setData] = useState<GuardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const load = useCallback(
    () =>
      getGuardOverview().then(
        (overview) => {
          setData(overview);
          setError(null);
        },
        (reason) => setError(errorMessage(reason)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function lift(ban: GuardBan) {
    if (!confirm(`${ban.ip} 차단을 풀까요?`)) return;
    try {
      await liftGuardBan(ban.id);
      onStatus({ message: `${ban.ip} 차단을 풀었습니다.`, tone: 'ok' });
      await load();
    } catch (reason) {
      onStatus({ message: errorMessage(reason), tone: 'error' });
    }
  }

  const events = data ? (all ? data.events : data.events.slice(0, SHOWN_EVENTS)) : [];

  return (
    <section className="admin-block guard" aria-labelledby="guard-title">
      <div className="community-section-head">
        <h3 id="guard-title">이상 징후</h3>
        <button type="button" className="guard-reload" onClick={() => load()}>
          새로 고침
        </button>
      </div>
      <p className="guard-lead">
        흔한 털기 주소, 횟수 초과, 로그인 실패, 쪽지의 숨은 칸을 주소마다 세고, 기준을 넘으면 그 주소의 API 요청을 저절로 막아요. 집과 tailnet 주소는 세지 않아요.
      </p>
      {error && <p className="community-empty">{error}</p>}
      {data && (
        <>
          <div className="guard-counts">
            {data.rules.map((rule) => (
              <div key={rule.kind} className={cx('guard-count', data.counts[rule.kind] > 0 && 'is-hot')}>
                <p className="guard-count-label">{GUARD_LABEL[rule.kind]}</p>
                <p className="guard-count-value">{data.counts[rule.kind].toLocaleString('ko-KR')}</p>
                <p className="guard-count-rule">
                  10분에 {rule.count}번이면 {rule.hours >= 24 ? `${rule.hours / 24}일` : `${rule.hours}시간`} 막음
                </p>
              </div>
            ))}
          </div>
          <p className="guard-note">숫자는 최근 24시간, 기록은 {data.keepDays}일 동안 남겨요.</p>

          <h4 className="guard-subtitle">막은 주소</h4>
          {data.bans.length ? (
            <div className="guard-table-wrap">
              <table className="guard-table">
                <thead>
                  <tr>
                    <th scope="col">주소</th>
                    <th scope="col">까닭</th>
                    <th scope="col">언제까지</th>
                    <th scope="col">돌려보낸 요청</th>
                    <th scope="col" aria-label="풀기" />
                  </tr>
                </thead>
                <tbody>
                  {data.bans.map((ban) => (
                    <tr key={ban.id}>
                      <td className="guard-ip">{ban.ip}</td>
                      <td>{ban.reason}</td>
                      <td>{formatDateTime(ban.until)}까지</td>
                      <td>{ban.blocked.toLocaleString('ko-KR')}건 돌려보냄</td>
                      <td>
                        <button type="button" className="guard-lift" onClick={() => lift(ban)}>
                          풀기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="guard-empty">지금 막힌 주소가 없어요.</p>
          )}

          <div className="guard-columns">
            <div>
              <h4 className="guard-subtitle">많이 두드린 주소</h4>
              {data.topIps.length ? (
                <ol className="guard-top">
                  {data.topIps.map((row) => (
                    <li key={row.ip}>
                      <span className="guard-ip">{row.ip}</span>
                      <span className="guard-kinds">{row.kinds.map((kind) => GUARD_LABEL[kind]).join(', ')}</span>
                      <b>{row.count.toLocaleString('ko-KR')}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="guard-empty">최근 24시간 동안 수상한 주소가 없어요.</p>
              )}
            </div>
            <div>
              <h4 className="guard-subtitle">최근 기록</h4>
              {events.length ? (
                <div className="guard-log-wrap">
                  <ol className="guard-log">
                    {events.map((event, index) => (
                      <li key={`${event.at}-${index}`} title={event.agent || 'User-Agent 없음'}>
                        <span>{clock.format(new Date(event.at))}</span>
                        <span className={cx('guard-kind', `is-${event.kind as GuardKind}`)}>{GUARD_LABEL[event.kind]}</span>
                        <span>{event.ip}</span>
                        <span>
                          {event.method} {event.path}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {data.events.length > SHOWN_EVENTS && (
                    <button type="button" className="guard-more" onClick={() => setAll((value) => !value)}>
                      {all ? '줄이기' : `${data.events.length}줄 모두 보기`}
                    </button>
                  )}
                </div>
              ) : (
                <p className="guard-empty">아직 남은 기록이 없어요.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
