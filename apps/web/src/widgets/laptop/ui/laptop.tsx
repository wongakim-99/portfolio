'use client';

import type { CSSProperties } from 'react';
import { formatDuration } from '@shared/lib';
import type { ServerStatusState } from '@entities/server-status';
import { STICKERS } from '../model/stickers';
import { useStickerDrag } from '../model/use-sticker-drag';
import './laptop.css';

function caption({ latest, online }: ServerStatusState) {
  if (online === false) return '서버 상태를 불러오지 못했어요. 페이지는 그대로 볼 수 있어요.';
  if (!online || !latest) return '이 페이지를 보내고 있는 집 노트북';
  const bits = [`켜진 지 ${formatDuration(latest.uptime)}`];
  if (latest.cpuTemp !== null) bits.push(`CPU ${latest.cpuTemp}°C`);
  if (latest.battery) bits.push(`배터리 ${latest.battery.percent}%`);
  return `이 페이지를 보내는 집 노트북 / ${bits.join(' / ')}`;
}

/** 이 페이지를 보내는 집 노트북의 뚜껑. LED 는 서버가 응답하면 초록으로 숨 쉬고, 끊기면 주황 */
export function Laptop({ server }: { server: ServerStatusState }) {
  const { lidRef, stickerRef, lidHandlers, reset } = useStickerDrag();
  const led = server.online === null ? undefined : server.online ? 'on' : 'off';

  return (
    <figure className="laptop">
      <p className="hand laptop-hint" aria-hidden="true">
        스티커는 끌어서 옮길 수 있어요
        <svg viewBox="0 0 60 40">
          <path d="M4 6c18 2 34 10 44 26m0 0-1-11m1 11-10-5" />
        </svg>
      </p>
      <div className="lid" ref={lidRef} aria-hidden="true" {...lidHandlers}>
        <span className="hinge" />
        <span className="led" data-state={led} />
        {STICKERS.map((sticker) => (
          <span
            key={sticker.key}
            ref={stickerRef(sticker.key)}
            className={`sticker ${sticker.className}`}
            style={{ '--x': sticker.x, '--y': sticker.y, '--r': sticker.r } as CSSProperties}
          >
            {sticker.content}
          </span>
        ))}
      </div>
      <figcaption className="laptop-caption">
        <span>{caption(server)}</span>
        <button className="text-btn" type="button" onClick={reset}>
          스티커 제자리로
        </button>
      </figcaption>
    </figure>
  );
}
