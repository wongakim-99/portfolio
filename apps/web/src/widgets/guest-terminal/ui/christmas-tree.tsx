'use client';

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@shared/lib';
import { treeFrame } from '../lib/christmas-tree';

const FONT = '600 14px "IBM Plex Mono", ui-monospace, Menlo, monospace';
const LINE = 16;
const FRAME_MS = 33;

/** 터미널 전체를 채우는 돌아가는 트리. 움직임을 줄이는 설정이면 한 장만 그림 */
export function ChristmasTree({ onExit }: { onExit: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!box || !canvas || !context) return;
    box.focus();

    let width = 0;
    let height = 0;
    let cellWidth = 8;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      ({ width, height } = box.getBoundingClientRect());
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.font = FONT;
      cellWidth = context.measureText('M').width || 8;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);

    const still = prefersReducedMotion();
    const started = performance.now();
    let frame = 0;
    let last = -Infinity;
    const draw = (now: number) => {
      if (!still) frame = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      const cols = Math.floor(width / cellWidth);
      const rows = Math.floor(height / LINE);
      const left = (width - cols * cellWidth) / 2;
      const cells = treeFrame(cols, rows, still ? 1.4 : (now - started) / 1000);

      context.clearRect(0, 0, width, height);
      context.font = FONT;
      context.textBaseline = 'top';
      // 빛 번짐은 비싸서 전구, 별, 글자에만 씀
      context.shadowBlur = 0;
      for (const cell of cells) {
        if (cell.glow) continue;
        context.fillStyle = cell.color;
        context.fillText(cell.ch, left + cell.x * cellWidth, cell.y * LINE);
      }
      for (const cell of cells) {
        if (!cell.glow) continue;
        context.shadowColor = cell.color;
        context.shadowBlur = cell.glow;
        context.fillStyle = cell.color;
        context.fillText(cell.ch, left + cell.x * cellWidth, cell.y * LINE);
      }
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="term-tree"
      ref={boxRef}
      tabIndex={0}
      role="img"
      aria-label="눈 내리는 밤에 빙글빙글 도는 크리스마스 트리. q 를 누르면 나감"
      onKeyDown={(event) => {
        if (event.key === 'q' || event.key === 'Escape' || (event.ctrlKey && event.key === 'c')) {
          event.preventDefault();
          onExit();
        }
      }}
    >
      <canvas ref={canvasRef} />
      <p className="term-tree-hint" aria-hidden="true">
        q 를 누르면 나가요
      </p>
    </div>
  );
}
