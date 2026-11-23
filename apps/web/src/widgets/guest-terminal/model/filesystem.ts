import { routes } from '@shared/config';
import { formatDate, formatDuration } from '@shared/lib';
import { listBlogPosts } from '@entities/blog-post';
import { PORTFOLIO_PDF, portfolio } from '@entities/portfolio';
import { listPosts } from '@entities/post';
import { formatBattery, getServerStatus } from '@entities/server-status';

// 숨은 터미널의 가짜 파일 시스템. 디렉터리는 페이지, 파일은 페이지 안의 섹션이나 읽을거리
// ~ 가 홈(/)이고, cd 하면 그 디렉터리의 페이지로 실제로 이동함

/** ~ 아래 경로. [] 가 ~ */
export type FsPath = readonly string[];

export interface FsNode {
  name: string;
  /** 디렉터리의 항목. 피드 글처럼 API 에서 받아 오는 건 함수 */
  children?: readonly FsNode[] | (() => Promise<readonly FsNode[]>);
  /** 이 항목을 보여 주는 페이지. 섹션 파일은 #앵커까지 */
  href?: string;
  /** cat 으로 읽는 내용 */
  read?: () => string | Promise<string>;
  /** open 하면 내려받는 파일 */
  download?: { href: string; filename: string };
  /** ls 에서 이름 옆에 붙는 설명 (글 제목) */
  note?: string;
  /** ls -a 에서만 보임 */
  hidden?: boolean;
}

export const isDir = (node: FsNode) => node.children !== undefined;

const section = (name: string, read: () => string): FsNode => ({ name, href: `${routes.portfolio}#${name}`, read });

const PORTFOLIO_FILES: readonly FsNode[] = [
  section('about', () => portfolio.about.map((item) => `[${item.label}]\n${item.text}`).join('\n\n')),
  section('work', () => portfolio.work.map((item) => `${item.title}  (${item.period})`).join('\n')),
  section('projects', () => portfolio.projects.map((item) => `${item.title}  (${item.period})`).join('\n')),
  section('skills', () => portfolio.skills.map((group) => `${group.label}: ${group.items.join(', ')}`).join('\n')),
  section('history', () => portfolio.history.map((item) => [item.when, item.what, item.note].filter(Boolean).join(' ')).join('\n')),
];

async function serverReport() {
  const status = await getServerStatus();
  return [
    `버전: ${status.release?.commit ?? '로컬'}`,
    `켜진 지: ${formatDuration(status.uptime)}`,
    `CPU: ${status.cores}코어${status.cpuTemp === null ? '' : `, ${status.cpuTemp}°C`}`,
    `부하 (1분): ${status.load.toFixed(2)}`,
    `메모리: ${status.memoryUsedPercent}%`,
    `배터리: ${formatBattery(status.battery)}`,
  ].join('\n');
}

// 최근 글 10개를 글 ID 이름의 파일로 보여 줌. 받은 목록은 Tab 자동 완성에도 씀
async function recentPosts(): Promise<readonly FsNode[]> {
  const { posts } = await listPosts();
  // 짧은 글은 제목이 없어서 본문 첫 줄을 이름표로 씀
  return posts.map((post) => {
    const label = post.title || post.excerpt.split('\n')[0]!.slice(0, 40) || '(사진)';
    const extras = [post.photos.length ? `사진 ${post.photos.length}장` : '', post.video ? `유튜브: ${post.video.title ?? post.video.id}` : ''].filter(Boolean);
    return {
      name: post.id,
      note: label,
      href: routes.post(post.id),
      read: () =>
        [
          `${post.title ? `${post.title}\n` : ''}${post.authorName} / ${formatDate(post.createdAt)} / 하트 ${post.likeCount} / 답글 ${post.commentCount}`,
          `${post.excerpt}${post.truncated ? '…' : ''}`,
          ...extras,
        ].join('\n\n'),
    };
  });
}

// 블로그 최근 글. 잠긴 글은 제목만 보이고 읽으려 하면 권한이 없다고 함
async function blogPosts(): Promise<readonly FsNode[]> {
  const { posts } = await listBlogPosts();
  return posts.map((post) => ({
    name: post.id,
    note: post.locked ? `${post.title} (잠김)` : post.title,
    href: routes.blogPost(post.id),
    read: () =>
      post.excerpt === null
        ? `cat: ${post.id}: Permission denied\n주인장에게 허락받거나 P = NP 를 증명해 오세요. open ~/blog/${post.id} 하면 문제지를 드립니다.`
        : `${post.title}\n${formatDate(post.createdAt)}\n\n${post.excerpt}${post.excerpt.length >= 220 ? '…' : ''}`,
  }));
}

export const ROOT: FsNode = {
  name: '~',
  href: routes.home,
  children: [
    { name: 'portfolio', href: routes.portfolio, children: PORTFOLIO_FILES },
    { name: 'blog', href: routes.blog, children: blogPosts },
    {
      name: 'feed',
      href: routes.feed,
      children: [
        { name: 'posts', href: routes.feed, children: recentPosts },
        { name: 'admin', href: routes.admin, children: [] },
      ],
    },
    { name: 'server', href: `${routes.home}#server`, read: serverReport },
    { name: 'note', href: `${routes.home}#note`, read: () => '엽서는 화면에서 써 주세요. open note 하면 그 자리로 가요.' },
    { name: 'gawon-portfolio.pdf', download: PORTFOLIO_PDF, read: () => '바이너리 파일이라 여기서는 못 읽어요. open gawon-portfolio.pdf 로 받아 보세요.' },
    { name: '.christmas', hidden: true, read: () => '12월에는 이 방에 트리를 세워 둬요.\ntree 를 입력해 보세요. 나갈 때는 q.' },
  ],
};

/* 경로 */

/** cd, ls 의 인자를 ~ 아래 경로로 바꿈. / 와 /home/guest 도 ~ 로 봄 */
export function resolvePath(cwd: FsPath, input: string): FsPath {
  const raw = input.trim();
  const absolute = raw === '' || raw === '~' || raw.startsWith('~/') || raw.startsWith('/');
  const rest = raw.replace(/^~\/?/, '').replace(/^\/(home\/guest\/?)?/, '');
  const path = absolute ? [] : [...cwd];
  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') path.pop();
    else path.push(part);
  }
  return path;
}

/** 프롬프트에 보이는 모양: ~/feed/posts */
export const displayPath = (path: FsPath) => (path.length ? `~/${path.join('/')}` : '~');
/** pwd 가 보여 주는 모양: /home/guest/feed/posts */
export const absolutePath = (path: FsPath) => `/home/guest${path.length ? `/${path.join('/')}` : ''}`;

/* 찾기 */

// API 에서 받아 온 디렉터리 항목. 자동 완성처럼 기다릴 수 없는 곳에서 씀
const loaded = new WeakMap<FsNode, readonly FsNode[]>();

export async function childrenOf(node: FsNode): Promise<readonly FsNode[]> {
  if (!node.children) return [];
  if (typeof node.children !== 'function') return node.children;
  const children = await node.children();
  loaded.set(node, children);
  return children;
}

/** 이미 아는 항목만. 아직 안 받아 온 글 목록은 빈 목록 */
export function cachedChildren(node: FsNode): readonly FsNode[] {
  if (!node.children) return [];
  return typeof node.children === 'function' ? (loaded.get(node) ?? []) : node.children;
}

export async function findNode(path: FsPath): Promise<FsNode | null> {
  let node = ROOT;
  for (const name of path) {
    const next = (await childrenOf(node)).find((child) => child.name === name);
    if (!next) return null;
    node = next;
  }
  return node;
}

export function findCachedNode(path: FsPath): FsNode | null {
  let node = ROOT;
  for (const name of path) {
    const next = cachedChildren(node).find((child) => child.name === name);
    if (!next) return null;
    node = next;
  }
  return node;
}

/** 이 경로(디렉터리)를 보여 주는 페이지 주소. 페이지가 없으면 가장 가까운 위 디렉터리의 페이지 */
export function pageOf(path: FsPath): string {
  for (let depth = path.length; depth >= 0; depth--) {
    const href = findCachedNode(path.slice(0, depth))?.href;
    if (href) return href.split('#')[0] ?? routes.home;
  }
  return routes.home;
}

/** 지금 페이지 주소에 맞는 디렉터리. 글 화면은 ~/feed/posts 나 ~/blog, 회원 페이지처럼 없는 곳은 가장 가까운 위 디렉터리 */
export function dirForPathname(pathname: string): FsPath {
  if (pathname.startsWith(`${routes.feed}/posts/`)) return ['feed', 'posts'];
  const path: string[] = [];
  let node = ROOT;
  for (const part of pathname.split('/').filter(Boolean)) {
    const next = cachedChildren(node).find((child) => child.name === part && isDir(child));
    if (!next) break;
    path.push(part);
    node = next;
  }
  return path;
}

/** 다른 곳에 같은 이름이 있으면 '혹시 ~/portfolio/about ?' 처럼 알려 줌 */
export function suggestPath(name: string): FsPath | null {
  const target = name.replace(/\/$/, '').split('/').at(-1);
  if (!target) return null;
  const walk = (node: FsNode, path: FsPath): FsPath | null => {
    for (const child of cachedChildren(node)) {
      const childPath = [...path, child.name];
      if (child.name === target && !child.hidden) return childPath;
      const found = walk(child, childPath);
      if (found) return found;
    }
    return null;
  };
  return walk(ROOT, []);
}
