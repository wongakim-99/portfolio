import { formatDuration } from '@shared/lib';
import { formatBattery, getServerStatus } from '@entities/server-status';
import {
  absolutePath,
  cachedChildren,
  childrenOf,
  displayPath,
  findCachedNode,
  findNode,
  isDir,
  resolvePath,
  suggestPath,
  type FsNode,
  type FsPath,
} from './filesystem';

// 숨은 터미널의 명령. 진짜 리눅스는 아니지만 ls, cd, cat 처럼 익숙한 명령으로 사이트를 돌아다님
// 화면을 바꾸는 일(페이지 이동, 터미널 닫기, 트리 켜기)은 TerminalContext 로 부탁함

export type Tone = 'cmd' | 'dim' | 'ok' | 'err' | 'dir' | 'pdf' | 'hidden';
export interface Part {
  text: string;
  tone?: Tone;
}
/** 글자 그대로, 또는 색을 나눈 조각들 */
export type Output = string | Part[];

export interface TerminalContext {
  cwd: FsPath;
  /** 직전 위치 (cd -) */
  previousCwd: FsPath | null;
  /** 위치를 바꾸고 그 페이지로 이동. 페이지가 바뀌면 터미널을 닫아 화면을 보여 줌 */
  changeDir: (path: FsPath) => void;
  /** 그 주소로 이동하고 터미널을 닫음 */
  show: (href: string) => void;
  download: (href: string, filename: string) => void;
  history: readonly string[];
  highFive: () => void;
  /** 스탠드를 켜거나 끄고 바뀐 뒤 어두운지 돌려줌 */
  toggleLamp: () => boolean;
  startTree: () => void;
  clear: () => void;
  close: () => void;
}

type Command = (args: string[], context: TerminalContext) => Output | Promise<Output>;

const missing = (command: string, target: string, what = '그런 파일이나 디렉터리가 없어요') => {
  const guess = suggestPath(target);
  return `${command}: ${target}: ${what}${guess ? `. 혹시 ${displayPath(guess)} ?` : ''}`;
};

const toneOf = (node: FsNode): Tone | undefined => (isDir(node) ? 'dir' : node.download ? 'pdf' : node.hidden ? 'hidden' : undefined);
const label = (node: FsNode) => `${node.name}${isDir(node) ? '/' : ''}`;

async function ls(args: string[], context: TerminalContext): Promise<Output> {
  const flags = args.filter((arg) => arg.startsWith('-')).join('');
  const target = args.find((arg) => !arg.startsWith('-')) ?? '.';
  const node = await findNode(resolvePath(context.cwd, target));
  if (!node) return missing('ls', target);
  if (!isDir(node)) return [{ text: label(node), tone: toneOf(node) }];
  let entries: readonly FsNode[];
  try {
    entries = await childrenOf(node);
  } catch {
    return 'ls: 지금은 목록을 불러오지 못했어요. 잠시 뒤에 다시 해 보세요.';
  }
  const shown = entries.filter((entry) => flags.includes('a') || !entry.hidden);
  if (!shown.length) return [{ text: '여기는 파일이 없어요. 화면을 보려면 open .', tone: 'dim' }];
  // 글 목록처럼 설명이 붙거나 -l 이면 한 줄에 하나씩
  if (flags.includes('l') || shown.some((entry) => entry.note)) {
    return shown.flatMap((entry, index) => [
      ...(index ? [{ text: '\n' }] : []),
      { text: label(entry), tone: toneOf(entry) },
      ...(entry.note ? [{ text: `  ${entry.note}` }] : []),
    ]);
  }
  return shown.flatMap((entry, index) => [...(index ? [{ text: '  ' }] : []), { text: label(entry), tone: toneOf(entry) }]);
}

async function cd([target]: string[], context: TerminalContext): Promise<Output> {
  if (target === '-') {
    if (!context.previousCwd) return 'cd: 직전 위치가 없어요';
    context.changeDir(context.previousCwd);
    return '';
  }
  const path = resolvePath(context.cwd, target ?? '~');
  const node = await findNode(path);
  if (!node) return missing('cd', target ?? '~', '그런 디렉터리가 없어요');
  if (!isDir(node)) {
    // 섹션이나 글처럼 자리가 있는 파일이면 그 자리로 데려다줌
    if (node.href) {
      context.show(node.href);
      return '';
    }
    return `cd: ${target}: 디렉터리가 아니에요`;
  }
  context.changeDir(path);
  return '';
}

async function cat(args: string[], context: TerminalContext): Promise<Output> {
  if (!args.length) return 'cat: 무엇을 볼지 적어 주세요. 예) cat portfolio/about';
  const outputs: string[] = [];
  for (const target of args) {
    const node = await findNode(resolvePath(context.cwd, target));
    if (!node) outputs.push(missing('cat', target));
    else if (isDir(node)) outputs.push(`cat: ${target}: 디렉터리예요. ls ${target} 로 보세요`);
    else if (!node.read) outputs.push(`cat: ${target}: 읽을 수 없는 파일이에요`);
    else {
      try {
        outputs.push(await node.read());
      } catch {
        outputs.push(`cat: ${target}: 지금은 읽을 수 없어요. 잠시 뒤에 다시 해 보세요`);
      }
    }
  }
  return outputs.join('\n\n');
}

async function open([target = '.']: string[], context: TerminalContext): Promise<Output> {
  const node = await findNode(resolvePath(context.cwd, target));
  if (!node) return missing('open', target);
  if (node.download) {
    context.download(node.download.href, node.download.filename);
    return `${node.name} 받는 중`;
  }
  if (!node.href) return `open: ${target}: 화면에 보여 줄 곳이 없어요. cat ${target} 로 읽어 보세요`;
  context.show(node.href);
  return '';
}

// tree 에 경로를 주면 진짜 tree 처럼 폴더 구조를, 그냥 치면 크리스마스 트리를 보여 줌
async function tree(args: string[], context: TerminalContext): Promise<Output> {
  const target = args.find((arg) => !arg.startsWith('-'));
  if (!args.length) {
    context.startTree();
    return '';
  }
  const path = resolvePath(context.cwd, target ?? '.');
  const root = await findNode(path);
  if (!root) return missing('tree', target ?? '.');
  const parts: Part[] = [{ text: target ?? '.', tone: 'dir' }];
  let dirs = 0;
  let files = 0;
  const walk = async (node: FsNode, prefix: string) => {
    const entries = (await childrenOf(node).catch(() => [])).filter((entry) => !entry.hidden);
    for (const [index, entry] of entries.entries()) {
      const last = index === entries.length - 1;
      parts.push({ text: `\n${prefix}${last ? '└── ' : '├── '}` }, { text: entry.name, tone: toneOf(entry) });
      if (entry.note) parts.push({ text: `  ${entry.note}`, tone: 'dim' });
      if (isDir(entry)) {
        dirs += 1;
        await walk(entry, `${prefix}${last ? '    ' : '│   '}`);
      } else {
        files += 1;
      }
    }
  };
  if (isDir(root)) await walk(root, '');
  parts.push({ text: `\n\n${dirs} directories, ${files} files`, tone: 'dim' });
  return parts;
}

async function neofetch(): Promise<Output> {
  try {
    const server = await getServerStatus();
    const art = ['  .------------.', '  |  gawon-dev |', '  |    [==]    |', '  |         o  |', "  '------------'", '                ', '                ', '                '];
    const info = [
      'guest@gawon-dev',
      '---------------',
      'Host: 집에 있는 노트북',
      `Uptime: ${formatDuration(server.uptime)}`,
      `CPU: ${server.cores}코어${server.cpuTemp === null ? '' : `, ${server.cpuTemp}°C`}`,
      `Load: ${server.load.toFixed(2)}`,
      `Memory: ${server.memoryUsedPercent}%`,
      `Battery: ${formatBattery(server.battery)}`,
    ];
    return info.map((line, index) => `${art[index]}   ${line}`).join('\n');
  } catch {
    return '서버 상태를 못 불러왔어요. 잠시 뒤에 다시 해 보세요.';
  }
}

const CURL_TARGETS = ['/api/health', '/api/server', '/api/views', '/api/high-fives'];

const vim: Command = () => '에디터는 없어요. 나가는 법을 몰라도 괜찮아요.';
const clear: Command = (_, context) => {
  context.clear();
  return '';
};
const exit: Command = (_, context) => {
  context.close();
  return '';
};
const hi5: Command = (_, context) => {
  context.highFive();
  return '짝! 하이파이브 보냈어요.';
};

export const COMMANDS: Record<string, Command> = {
  help: () =>
    [
      '쓸 수 있는 명령 (사이트를 폴더처럼 돌아다녀요. ~ 가 홈)',
      '  ls [경로]         목록 보기. ls -a 는 숨은 파일까지',
      '  cd <경로>         그 페이지로 이동. cd portfolio, cd .., cd ~, cd -',
      '  pwd              지금 위치',
      '  cat <파일>        내용 보기. cat portfolio/about',
      '  open <경로>       화면에서 열기. PDF 는 내려받기',
      '  tree <경로>       폴더 구조 보기',
      '  neofetch         서버 정보',
      '  curl /api/health 헬스체크',
      '  hi5              하이파이브 보내기',
      '  lamp             스탠드 켜고 끄기',
      '  history, whoami, date, echo, clear, exit',
    ].join('\n'),
  ls,
  ll: (args, context) => ls(['-l', ...args], context),
  cd,
  pwd: (_, context) => absolutePath(context.cwd),
  cat,
  less: cat,
  more: cat,
  open,
  'xdg-open': open,
  tree,
  neofetch,
  uptime: async () => {
    try {
      const server = await getServerStatus();
      return `up ${formatDuration(server.uptime)}, load ${server.load.toFixed(2)}`;
    } catch {
      return '아직 몰라요.';
    }
  },
  curl: async (args) => {
    const target = args.find((arg) => arg.startsWith('/api/'));
    if (!target || !CURL_TARGETS.includes(target)) return `curl: 여기서는 ${CURL_TARGETS.join(', ')} 만 돼요`;
    try {
      const response = await fetch(target);
      return `HTTP ${response.status}\n${JSON.stringify(await response.json(), null, 2)}`;
    } catch {
      return 'curl: 서버에 닿지 않았어요';
    }
  },
  pdf: (_, context) => open(['~/gawon-portfolio.pdf'], context),
  hi5,
  highfive: hi5,
  lamp: (_, context) => (context.toggleLamp() ? '스탠드 껐어요.' : '스탠드 켰어요.'),
  history: (_, context) => context.history.map((line, index) => `${String(index + 1).padStart(4)}  ${line}`).join('\n'),
  whoami: () => 'guest (이 방 주인은 gawon)',
  uname: (args) => (args.includes('-a') ? 'Linux gawon-dev 6.8.0 x86_64 GNU/Linux (사실은 Next.js 가 흉내 내는 중)' : 'Linux'),
  date: () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  echo: (args) => args.join(' '),
  clear,
  cls: clear,
  exit,
  quit: exit,
  sudo: () => 'guest is not in the sudoers file. This incident will be reported.',
  rm: () => 'rm: 여기 제 방이에요. 지우지 말아 주세요.',
  mkdir: () => 'mkdir: 여기는 구경만 하는 방이에요.',
  touch: () => 'touch: 여기는 구경만 하는 방이에요.',
  ssh: () => 'Permission denied (publickey).',
  vim,
  vi: vim,
  nano: vim,
  git: (args) => (args[0] === 'push' ? 'main 에 push 하면 진짜 배포돼요. 여기서는 참을게요.' : `git ${args.join(' ')}: 여기서는 안 돼요`),
};

/** 한 줄을 실행해 출력을 돌려줌. 없는 명령이면 known 이 false */
export async function runCommand(line: string, context: TerminalContext): Promise<{ output: Output; known: boolean } | null> {
  const [name, ...args] = line.trim().split(/\s+/);
  if (!name) return null;
  const command = COMMANDS[name.toLowerCase()];
  if (!command) return { output: `command not found: ${name}. help 를 입력해 보세요.`, known: false };
  return { output: await command(args, context), known: true };
}

const commonPrefix = (words: string[]) =>
  words.reduce((prefix, word) => {
    let length = 0;
    while (length < prefix.length && prefix[length] === word[length]) length++;
    return prefix.slice(0, length);
  });

/** Tab 자동 완성. 첫 단어는 명령, 그 뒤는 경로. 여러 개면 겹치는 데까지 채우고 후보를 돌려줌 */
export function complete(value: string, cwd: FsPath): { value: string; candidates: string[] } {
  const words = value.split(' ');
  const word = words.at(-1) ?? '';
  const replaceLast = (next: string) => [...words.slice(0, -1), next].join(' ');

  if (words.length === 1) {
    const matches = word ? Object.keys(COMMANDS).filter((name) => name.startsWith(word)) : [];
    if (matches.length === 1) return { value: `${matches[0]} `, candidates: [] };
    return matches.length ? { value: replaceLast(commonPrefix(matches)), candidates: matches } : { value, candidates: [] };
  }

  const slash = word.lastIndexOf('/');
  const dirPart = word.slice(0, slash + 1);
  const base = word.slice(slash + 1);
  const dir = findCachedNode(resolvePath(cwd, dirPart || '.'));
  if (!dir || !isDir(dir)) return { value, candidates: [] };
  const matches = cachedChildren(dir)
    .filter((child) => child.name.startsWith(base) && (!child.hidden || base.startsWith('.')))
    .map(label);
  if (matches.length === 1) {
    const match = matches[0] ?? '';
    return { value: replaceLast(`${dirPart}${match}${match.endsWith('/') ? '' : ' '}`), candidates: [] };
  }
  return matches.length ? { value: replaceLast(`${dirPart}${commonPrefix(matches)}`), candidates: matches } : { value, candidates: [] };
}
