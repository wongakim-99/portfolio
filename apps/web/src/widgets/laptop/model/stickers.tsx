import type { ReactNode } from 'react';

export interface StickerSpot {
  x: string;
  y: string;
}

export interface Sticker extends StickerSpot {
  key: string;
  className: string;
  /** 붙인 각도 */
  r: string;
  content: ReactNode;
}

// 뚜껑 위 스티커. 위치는 뚜껑 크기에 대한 비율이라 화면 폭이 바뀌어도 같은 자리에 붙어 있음
export const STICKERS: readonly Sticker[] = [
  {
    key: 'hello',
    className: 'st-hello',
    x: '5%',
    y: '12%',
    r: '-6deg',
    content: (
      <>
        <b>HELLO</b>
        <i>my name is</i>
        <em>가원</em>
      </>
    ),
  },
  { key: 'host', className: 'st-dymo', x: '52%', y: '9%', r: '2deg', content: 'gawon-dev' },
  { key: 'spring', className: 'st-spring', x: '38%', y: '30%', r: '-3deg', content: 'Spring Boot' },
  {
    key: 'award',
    className: 'st-award',
    x: '73%',
    y: '24%',
    r: '9deg',
    content: (
      <>
        <b>최우수상</b>
        <small>
          2025 세종 DX
          <br />
          해커톤
        </small>
      </>
    ),
  },
  {
    key: 'pipe',
    className: 'st-pipe',
    x: '6%',
    y: '55%',
    r: '2deg',
    content: (
      <>
        Vue 3 <i>&rarr;</i> Spring Boot <i>&rarr;</i> AI
      </>
    ),
  },
  { key: 'nest', className: 'st-nest', x: '62%', y: '57%', r: '-8deg', content: 'NestJS' },
  { key: 'ubuntu', className: 'st-ubuntu', x: '30%', y: '76%', r: '4deg', content: 'Ubuntu Server' },
  { key: 'mongo', className: 'st-mongo', x: '79%', y: '76%', r: '-4deg', content: 'MongoDB' },
  {
    key: 'opic',
    className: 'st-opic',
    x: '8%',
    y: '80%',
    r: '-10deg',
    content: (
      <>
        OPIc<b>IH</b>
      </>
    ),
  },
];
