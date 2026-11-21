import { describe, expect, it } from 'vitest';
import { christmasCountdown, isChristmasSeason, TREE_INTRO_SECONDS, treeFrame } from '../lib/christmas-tree';
import { complete } from './commands';
import { absolutePath, dirForPathname, displayPath, pageOf, resolvePath } from './filesystem';

describe('터미널 경로', () => {
  it('cd, ls 인자를 ~ 아래 경로로 바꿈', () => {
    expect(resolvePath([], 'portfolio')).toEqual(['portfolio']);
    expect(resolvePath(['portfolio'], '..')).toEqual([]);
    expect(resolvePath(['portfolio'], '../feed/posts')).toEqual(['feed', 'posts']);
    expect(resolvePath(['feed', 'posts'], '~')).toEqual([]);
    expect(resolvePath(['feed'], '/portfolio/about')).toEqual(['portfolio', 'about']);
    expect(resolvePath(['feed'], '/home/guest/portfolio')).toEqual(['portfolio']);
    expect(resolvePath([], '../..')).toEqual([]);
  });

  it('프롬프트와 pwd 모양', () => {
    expect(displayPath([])).toBe('~');
    expect(displayPath(['feed', 'posts'])).toBe('~/feed/posts');
    expect(absolutePath(['portfolio'])).toBe('/home/guest/portfolio');
  });

  it('페이지 주소와 디렉터리를 서로 맞춤', () => {
    expect(dirForPathname('/')).toEqual([]);
    expect(dirForPathname('/portfolio')).toEqual(['portfolio']);
    expect(dirForPathname('/feed/admin')).toEqual(['feed', 'admin']);
    expect(dirForPathname('/feed/posts/6650a1')).toEqual(['feed', 'posts']);
    expect(dirForPathname('/feed/users/6650b2')).toEqual(['feed']);
    expect(dirForPathname('/blog/posts/6650c3')).toEqual(['blog']);
    expect(pageOf(['blog'])).toBe('/blog');
    expect(pageOf(['feed', 'posts'])).toBe('/feed');
    expect(pageOf(['feed', 'write'])).toBe('/feed/write');
    expect(pageOf([])).toBe('/');
  });
});

describe('Tab 자동 완성', () => {
  it('명령 이름과 경로를 채움', () => {
    expect(complete('tre', []).value).toBe('tree ');
    expect(complete('cd po', []).value).toBe('cd portfolio/');
    expect(complete('cat portfolio/ab', []).value).toBe('cat portfolio/about ');
    expect(complete('cd ../fe', ['portfolio']).value).toBe('cd ../feed/');
  });

  it('후보가 여럿이면 겹치는 데까지 채우고 후보를 돌려줌', () => {
    const result = complete('ls feed/', []);
    expect(result.candidates).toEqual(['posts/', 'write/', 'admin/']);
  });

  it('숨은 파일은 점으로 시작할 때만', () => {
    expect(complete('cat .', []).value).toBe('cat .christmas ');
    expect(complete('cat ', []).candidates).not.toContain('.christmas');
  });
});

describe('tree 이스터에그', () => {
  const cols = 80;
  const rows = 28;

  const done = TREE_INTRO_SECONDS + 1;
  const text = (time: number, y: number) =>
    treeFrame(cols, rows, time)
      .filter((cell) => cell.y === y && /[A-Z]/.test(cell.ch))
      .sort((a, b) => a.x - b.x)
      .map((cell) => cell.ch)
      .join('');

  it('다 만들어지면 별, 트리, 인사말이 화면 안에 그려짐', () => {
    const cells = treeFrame(cols, rows, done);
    expect(cells.every((cell) => cell.x >= 0 && cell.x < cols && cell.y >= 0 && cell.y < rows)).toBe(true);
    expect(cells.some((cell) => cell.y === 1 && cell.ch === '*' && cell.glow > 0)).toBe(true);
    expect(text(done, rows - 1)).toBe('MERRYCHRISTMAS');
  });

  it('처음에는 줄기부터 서고, 잎은 아래에서 위로 코드 글자가 흐르며 자람', () => {
    const start = treeFrame(cols, rows, 0.05);
    expect(start.some((cell) => cell.ch === '#' && cell.color === '#9a6a43')).toBe(true);
    expect(start.some((cell) => cell.y === 1 && cell.ch === '*')).toBe(false);
    expect(text(0.05, rows - 1)).toBe('');

    const growing = treeFrame(cols, rows, 1.0);
    const leafRows = new Set(growing.filter((cell) => cell.y >= 3 && cell.y < rows - 5 && cell.color.startsWith('hsl(1')).map((cell) => cell.y));
    expect(Math.min(...leafRows)).toBeGreaterThan(6);
    expect(growing.some((cell) => '01{}[]<>/;'.includes(cell.ch) && cell.glow > 0)).toBe(true);
  });

  it('별이 꽂힌 뒤 인사말이 한 글자씩 찍힘', () => {
    expect(treeFrame(cols, rows, 3.0).some((cell) => cell.y === 1 && cell.ch === '*' && cell.glow >= 20)).toBe(false);
    expect(treeFrame(cols, rows, 3.6).some((cell) => cell.y === 1 && cell.ch === '*' && cell.glow >= 20)).toBe(true);
    expect(text(3.75, rows - 1).length).toBeGreaterThan(0);
    expect(text(3.75, rows - 1).length).toBeLessThan(13);
  });

  it('시간이 흐르면 돌아서 그림이 바뀜', () => {
    const at = (time: number) => treeFrame(cols, rows, time).map((cell) => `${cell.x},${cell.y},${cell.ch}`).join('|');
    expect(at(done)).not.toBe(at(done + 1));
  });

  it('작은 화면에서도 깨지지 않음', () => {
    expect(treeFrame(30, 12, done).length).toBeGreaterThan(30);
  });

  it('크리스마스까지 남은 날 (서울 기준)', () => {
    expect(christmasCountdown(new Date('2026-11-21T03:00:00Z'))).toContain('D-34');
    expect(christmasCountdown(new Date('2026-12-24T16:00:00Z'))).toContain('오늘');
    expect(christmasCountdown(new Date('2026-12-26T03:00:00Z'))).toContain('D-364');
    expect(isChristmasSeason(new Date('2026-12-10T03:00:00Z'))).toBe(true);
    expect(isChristmasSeason(new Date('2026-11-21T03:00:00Z'))).toBe(false);
  });
});
