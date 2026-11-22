'use client';

import { setRockyOn, useRockyMode } from '../lib/preference';
import { RockyArt } from './rocky-art';
import './rocky.css';

/** 내 페이지 '화면 설정' 의 한 줄. 블로그 빈 책상의 로키를 켜고 끔 (코랩의 강아지, 고양이 모드처럼) */
export function RockySetting() {
  const mode = useRockyMode();
  const on = mode === 'on';
  return (
    <label className="rocky-setting" data-on={on}>
      <span className="rocky-setting-art" aria-hidden="true">
        <RockyArt />
      </span>
      <span className="rocky-setting-text">
        <b>로키 보이기</b>
        <span>블로그 빈 책상을 굴러다니는 로키 공. 노트북, 데스크톱에서만 나오고, 이 브라우저에 남아요.</span>
        {mode === 'resting' && <span className="rocky-setting-note">지금 이 탭에서는 잠깐 쉬는 중이에요. 켜면 다시 나와요.</span>}
      </span>
      <input className="rocky-switch" type="checkbox" role="switch" checked={on} onChange={(event) => setRockyOn(event.target.checked)} />
    </label>
  );
}
