'use client';

import { cx, formatNumber } from '@shared/lib';
import type { HighFive as HighFiveState } from '../model/use-high-five';
import './high-five.css';

/** 상태는 홈 화면이 가짐. 숨은 터미널의 hi5 명령도 같은 상태로 보내야 해서 */
export function HighFive({ hi5 }: { hi5: HighFiveState }) {
  return (
    <div className="hi5">
      <button className={cx('hi5-btn', hi5.pressed && 'is-pressed')} type="button" onClick={hi5.give}>
        <span>하이파이브</span>
        {hi5.claps.map((clap) => (
          <span key={clap.id} className="clap" aria-hidden="true" style={clap.style} onAnimationEnd={() => hi5.dismissClap(clap.id)}>
            {clap.text}
          </span>
        ))}
      </button>
      <div className="hi5-text">
        <p className="hand">다 보셨으면 한 번 눌러 주세요</p>
        <p className="hi5-count">
          지금까지 <b>{hi5.total === null ? '-' : formatNumber(hi5.total)}</b>번 받았어요
        </p>
        <p className="hi5-status" role="status" aria-live="polite">
          {hi5.status}
        </p>
      </div>
    </div>
  );
}
