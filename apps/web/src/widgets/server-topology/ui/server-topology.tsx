'use client';

import { useEffect, useRef, useState } from 'react';
import { errorStatus } from '@shared/api';
import { getTopology, type TelemetryEvent } from '@entities/server-status';
import { TopologyEngine } from '../lib/topology-engine';
import './server-topology.css';

const POLL_MS = 2000;
const RECENT = 12;
const clock = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const LEGEND = [
  ['is-http', '페이지 요청'],
  ['is-ok', '정상 응답'],
  ['is-warn', '4xx 응답'],
  ['is-error', '5xx 응답'],
  ['is-db', 'DB 명령'],
  ['is-storage', '사진 저장소'],
] as const;

const toneOf = (status: number) => (status >= 500 ? 'is-error' : status >= 400 ? 'is-warn' : undefined);

/** 관리실 '서버 상태' 가운데의 '지금 흐름'. 요청 하나하나를 점으로 흘려 보여 줌. 권한(server:read)이 있을 때만 보임 */
export function ServerTopology() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [meta, setMeta] = useState('연결하는 중');
  const [recent, setRecent] = useState<TelemetryEvent[] | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const engine = new TopologyEngine(stage);
    engine.build();
    const resize = new ResizeObserver(() => engine.build());
    resize.observe(stage);

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cursor: number | null = null;

    async function poll() {
      timer = null;
      try {
        const data = await getTopology(cursor);
        if (stopped) return;
        // 첫 응답의 지난 기록은 점으로 흘리지 않고 목록에만 넣음
        if (cursor !== null) engine.replay(data.events, Date.now() - data.now);
        cursor = data.cursor;
        engine.render(data);
        const http = data.events.filter((event) => event.kind === 'http').reverse();
        setRecent((list) => [...http, ...(list ?? [])].slice(0, RECENT));
        setMeta(`2초마다 갱신, ${clock.format(Date.now())}`);
      } catch (error) {
        if (stopped) return;
        setMeta(errorStatus(error) === 403 ? '이 계정에는 권한이 없습니다.' : '서버에 닿지 않습니다. 다시 시도하는 중');
        engine.markDown();
      } finally {
        if (!stopped && !document.hidden) timer = setTimeout(poll, POLL_MS);
      }
    }

    // 다른 탭을 보는 동안에는 묻지 않고, 돌아오면 바로 다시 받음
    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else if (!timer) {
        poll();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    poll();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      resize.disconnect();
      engine.destroy();
    };
  }, []);

  return (
    <section className="admin-block" aria-labelledby="topology-title">
      <div className="community-section-head">
        <h3 id="topology-title">지금 흐름</h3>
        <span className="community-meta">{meta}</span>
      </div>
      <div className="topology-stage" ref={stageRef} />
      <ul className="topology-legend" aria-label="점 색깔">
        {LEGEND.map(([tone, label]) => (
          <li key={tone}>
            <i className={tone} />
            {label}
          </li>
        ))}
      </ul>
      {/* 노트북과 api 숫자는 위 '서버 상태'의 노트북, 프로세스 칸에 있어서 여기는 최근 요청만 */}
      <div className="topology-panels">
        <div className="topology-log-wrap">
          <p className="topology-log-title">최근 요청</p>
          <ol className="topology-log">
            {recent?.length === 0 && <li>아직 들어온 요청이 없습니다.</li>}
            {recent?.map((event) => (
              <li key={event.seq} className={toneOf(event.status)}>
                <span>{clock.format(event.at)}</span>
                <span>{event.label}</span>
                <span>{event.status}</span>
                <span>{event.ms}ms</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
