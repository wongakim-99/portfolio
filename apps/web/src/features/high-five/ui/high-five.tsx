'use client';

import { useEffect } from 'react';
import { cx, formatNumber } from '@shared/lib';
import { dismissClap, giveHighFive, loadHighFives, useHighFive } from '../model/use-high-five';
import './high-five.css';

export function HighFive() {
  const hi5 = useHighFive();
  useEffect(loadHighFives, []);

  return (
    <div className="hi5">
      <button className={cx('hi5-btn', hi5.pressed && 'is-pressed')} type="button" onClick={giveHighFive}>
        <span>하이파이브</span>
        {hi5.claps.map((clap) => (
          <span key={clap.id} className="clap" aria-hidden="true" style={clap.style} onAnimationEnd={() => dismissClap(clap.id)}>
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
