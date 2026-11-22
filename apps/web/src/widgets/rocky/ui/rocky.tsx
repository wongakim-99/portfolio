'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cx } from '@shared/lib';
import type { Point } from '../lib/motion';
import { RockyEngine } from '../lib/rocky-engine';
import { speak } from '../lib/speak';
import { BUMP_LINE, chordsFor, DIZZY_LINES, ROCKY_LINES } from '../lib/voice';
import { RockyArt } from './rocky-art';
import './rocky.css';

const SIZE = 92;
// '잠깐 쉬기' 를 누르면 이 창을 닫을 때까지 나오지 않음
const REST_KEY = 'gawon:rocky-resting';
// 이만큼 움직이면 누르기가 아니라 끌기
const DRAG_START = 5;
// 저절로 뜬 말풍선(어지러움)은 잠깐 뒤에 닫음
const AUTO_CLOSE_MS = 3200;
// 노트북, 데스크톱(마우스나 트랙패드, 1024px 이상)에서만. 휴대폰, 태블릿은 빈 책상도 좁고 손가락으로 잡기 어려워서 띄우지 않음 (rocky.css 와 같은 조건)
const DESKTOP = '(hover: hover) and (pointer: fine) and (min-width: 1024px)';
const ARROWS: Record<string, Point> = { ArrowLeft: { x: -80, y: 0 }, ArrowRight: { x: 80, y: 0 }, ArrowUp: { x: 0, y: -80 }, ArrowDown: { x: 0, y: 80 } };

const resting = () => {
  try {
    return sessionStorage.getItem(REST_KEY) === '1';
  } catch {
    return false;
  }
};

interface Drag {
  pointer: number;
  start: Point;
  /** 손과 공 가운데의 거리. 끄는 동안 공이 손 밑에서 미끄러지지 않게 함 */
  offset: Point;
  last: Point;
  lastTime: number;
  velocity: Point;
  moving: boolean;
}

type Bubble = { text: string; kind: 'talk' | 'bump' | 'dizzy' };

/** 빈 책상을 굴러다니는 로키. 누르면 말하고, 잡아서 끌고 던질 수 있고, 주먹을 맞댐 */
export function Rocky() {
  const root = useRef<HTMLDivElement>(null);
  const engine = useRef<RockyEngine | null>(null);
  const drag = useRef<Drag | null>(null);
  const [visible, setVisible] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [spoken, setSpoken] = useState(0);
  const [dizzy, setDizzy] = useState(0);
  const [gone, setGone] = useState(false);
  const bubbleId = useId();

  // 화면이 조건에 맞을 때만 엔진을 돌림. 창 크기를 바꿔 조건이 바뀌면 멈추거나 다시 시작함
  useEffect(() => {
    const el = root.current;
    if (!el || resting()) return;
    const desktop = matchMedia(DESKTOP);
    const sync = () => {
      if (desktop.matches && !engine.current) {
        engine.current = new RockyEngine(el, SIZE, {
          onVisible: setVisible,
          onDizzy: () => setDizzy((count) => count + 1),
        });
        engine.current.start();
      } else if (!desktop.matches && engine.current) {
        engine.current.stop();
        engine.current = null;
        setVisible(false);
        setBubble(null);
      }
    };
    sync();
    desktop.addEventListener('change', sync);
    return () => {
      desktop.removeEventListener('change', sync);
      engine.current?.stop();
      engine.current = null;
    };
  }, []);

  // 세게 던지면 어지럽다고 한마디. 화음도 낮게 한 번
  useEffect(() => {
    if (!dizzy) return;
    const text = DIZZY_LINES[(dizzy - 1) % DIZZY_LINES.length]!;
    speak(chordsFor(text).map((chord) => chord.map((note) => note / 2)));
    const show = window.setTimeout(() => setBubble({ text, kind: 'dizzy' }), 0);
    const hide = window.setTimeout(() => setBubble((current) => (current?.kind === 'dizzy' ? null : current)), AUTO_CLOSE_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [dizzy]);

  // 말풍선을 연 동안은 제자리에 있고, 바깥을 누르거나 Esc 로 닫음
  const open = bubble !== null && bubble.kind !== 'dizzy';
  useEffect(() => {
    if (!open) return;
    engine.current?.hold(true);
    const outside = (event: globalThis.PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setBubble(null);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setBubble(null);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      engine.current?.hold(false);
    };
  }, [open]);

  function say(text: string, kind: Bubble['kind'], action: 'hop' | 'bump') {
    setBubble({ text, kind });
    speak(chordsFor(text));
    engine.current?.act(action);
  }

  function talk() {
    const text = ROCKY_LINES[spoken % ROCKY_LINES.length]!;
    setSpoken((count) => count + 1);
    say(text, 'talk', 'hop');
  }

  function rest() {
    try {
      sessionStorage.setItem(REST_KEY, '1');
    } catch {
      // 저장하지 못해도 이번 화면에서는 숨김
    }
    engine.current?.stop();
    setGone(true);
  }

  // 누르면 말하기, 끌면 잡아서 옮기기, 놓으면 손의 속도로 던지기
  function down(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const center = engine.current?.center();
    if (!center) return;
    try {
      // 공 밖으로 손이 빨리 나가도 계속 따라오게 함
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 이미 떼어진 포인터면 잡지 않고 넘어감
    }
    const at = { x: event.clientX, y: event.clientY };
    drag.current = {
      pointer: event.pointerId,
      start: at,
      offset: { x: at.x - center.x, y: at.y - center.y },
      last: at,
      lastTime: event.timeStamp,
      velocity: { x: 0, y: 0 },
      moving: false,
    };
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const at = { x: event.clientX, y: event.clientY };
    if (!current.moving) {
      if (Math.hypot(at.x - current.start.x, at.y - current.start.y) < DRAG_START) return;
      current.moving = true;
      setBubble(null);
      engine.current?.grab();
    }
    // 손의 속도를 부드럽게 따라가며 잼. 놓는 순간의 속도로 던짐
    const seconds = Math.max(0.001, (event.timeStamp - current.lastTime) / 1000);
    current.velocity = {
      x: current.velocity.x * 0.5 + ((at.x - current.last.x) / seconds) * 0.5,
      y: current.velocity.y * 0.5 + ((at.y - current.last.y) / seconds) * 0.5,
    };
    current.last = at;
    current.lastTime = event.timeStamp;
    engine.current?.dragTo({ x: at.x - current.offset.x, y: at.y - current.offset.y });
  }

  function up(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    if (!current.moving) {
      talk();
      return;
    }
    // 손을 멈춘 채 놓으면 던지지 않고 내려놓음
    const still = event.timeStamp - current.lastTime > 80;
    engine.current?.release(still ? { x: 0, y: 0 } : current.velocity);
  }

  function cancel(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    if (current.moving) engine.current?.release({ x: 0, y: 0 });
  }

  // 키보드: Enter, Space 로 말 걸기(아래 onClick), 화살표로 공 밀기
  function key(event: KeyboardEvent<HTMLButtonElement>) {
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    engine.current?.nudge(arrow.x, arrow.y);
  }

  if (gone) return null;
  return (
    <div ref={root} className={cx('rocky', visible && 'is-visible')} aria-hidden={visible ? undefined : true}>
      <button
        type="button"
        className="rocky-ball"
        tabIndex={visible ? 0 : -1}
        aria-label="로키에게 말 걸기. 끌어서 굴리거나 화살표 키로 밀 수 있음"
        aria-expanded={open}
        aria-controls={open ? bubbleId : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onKeyDown={key}
        // 마우스, 손가락은 pointerup 에서 처리함. 키보드로 누를 때만 여기서 말함 (detail 0)
        onClick={(event) => event.detail === 0 && talk()}
      >
        <RockyArt />
      </button>
      {bubble && (
        <div id={bubbleId} className={cx('rocky-bubble', `is-${bubble.kind}`)} role="status">
          <p className="hand">{bubble.text}</p>
          {bubble.kind !== 'dizzy' && (
            <>
              <div className="rocky-bubble-actions">
                <button className="tape" type="button" onClick={() => say(BUMP_LINE, 'bump', 'bump')}>
                  주먹 맞대기
                </button>
                <button className="text-btn" type="button" onClick={rest}>
                  잠깐 쉬기
                </button>
              </div>
              <p className="rocky-hint">공을 잡아서 던져 볼 수도 있어요. 살살.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
