'use client';

import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { prefersReducedMotion, readStore, writeStore } from '@shared/lib';
import { STICKERS, type StickerSpot } from './stickers';

// 스티커 끌어서 옮기기. 위치는 이 브라우저에만 저장함
// 움직이는 동안은 다시 그리지 않도록 React 상태 대신 요소의 --x, --y 를 바로 바꿈
const STORE_KEY = 'stickers';
type SavedSpots = Record<string, StickerSpot>;

interface Drag {
  el: HTMLElement;
  box: DOMRect;
  dx: number;
  dy: number;
}

const place = (el: HTMLElement, { x, y }: StickerSpot) => {
  el.style.setProperty('--x', x);
  el.style.setProperty('--y', y);
};
const spotOf = (el: HTMLElement): StickerSpot => ({ x: el.style.getPropertyValue('--x'), y: el.style.getPropertyValue('--y') });

export function useStickerDrag() {
  const lidRef = useRef<HTMLDivElement>(null);
  const stickers = useRef(new Map<string, HTMLElement>());
  const drag = useRef<Drag | null>(null);
  const topLayer = useRef(10);
  const resetAnimations = useRef(new WeakMap<HTMLElement, Animation>());

  useEffect(() => {
    const saved = readStore<SavedSpots>(STORE_KEY) ?? {};
    for (const [key, el] of stickers.current) {
      const spot = saved[key];
      if (spot) place(el, spot);
    }
  }, []);

  const stickerRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (!el) return;
      stickers.current.set(key, el);
      return () => {
        stickers.current.delete(key);
      };
    },
    [],
  );

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const el = (event.target as Element).closest<HTMLElement>('.sticker');
    const lid = lidRef.current;
    if (!el || !lid || event.button !== 0) return;
    event.preventDefault();
    resetAnimations.current.get(el)?.finish();
    const box = lid.getBoundingClientRect();
    drag.current = { el, box, dx: event.clientX - box.left - el.offsetLeft, dy: event.clientY - box.top - el.offsetTop };
    el.setPointerCapture(event.pointerId);
    el.style.zIndex = String(++topLayer.current);
    el.classList.add('is-lifted');
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { el, box, dx, dy } = drag.current;
    // 스티커가 뚜껑 밖으로 반쯤 넘어가는 것까지는 허용
    const maxX = box.width - el.offsetWidth / 2;
    const maxY = box.height - el.offsetHeight / 2;
    const left = Math.min(Math.max(event.clientX - box.left - dx, -el.offsetWidth / 2), maxX);
    const top = Math.min(Math.max(event.clientY - box.top - dy, -el.offsetHeight / 2), maxY);
    place(el, { x: `${((left / box.width) * 100).toFixed(2)}%`, y: `${((top / box.height) * 100).toFixed(2)}%` });
  }, []);

  const onDrop = useCallback(() => {
    if (!drag.current) return;
    drag.current.el.classList.remove('is-lifted');
    drag.current = null;
    const spots: SavedSpots = {};
    for (const [key, el] of stickers.current) spots[key] = spotOf(el);
    writeStore(STORE_KEY, spots);
  }, []);

  /** 처음 자리로 돌려놓음. 움직임을 줄이는 설정이 아니면 원래 자리까지 미끄러지듯 돌아감 */
  const reset = useCallback(() => {
    const list = STICKERS.flatMap((sticker) => {
      const el = stickers.current.get(sticker.key);
      return el ? [{ sticker, el }] : [];
    });
    const previous = list.map(({ el }) => el.getBoundingClientRect());
    for (const { sticker, el } of list) {
      resetAnimations.current.get(el)?.cancel();
      place(el, sticker);
      el.style.zIndex = '';
    }
    if (!prefersReducedMotion()) {
      list.forEach(({ sticker, el }, index) => {
        const before = previous[index];
        if (!before) return;
        const after = el.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.hypot(dx, dy) < 2) return;
        const animation = el.animate(
          [{ transform: `translate(${dx}px, ${dy}px) rotate(${sticker.r})` }, { transform: `translate(0, 0) rotate(${sticker.r})` }],
          { duration: 420, delay: index * 18, easing: 'cubic-bezier(.16, 1, .3, 1)' },
        );
        resetAnimations.current.set(el, animation);
        const clear = () => {
          if (resetAnimations.current.get(el) === animation) resetAnimations.current.delete(el);
        };
        animation.addEventListener('finish', clear, { once: true });
        animation.addEventListener('cancel', clear, { once: true });
      });
    }
    writeStore(STORE_KEY, null);
  }, []);

  return {
    lidRef,
    stickerRef,
    lidHandlers: { onPointerDown, onPointerMove, onPointerUp: onDrop, onPointerCancel: onDrop },
    reset,
  };
}
