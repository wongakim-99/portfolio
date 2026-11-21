import { formatDuration } from '@shared/lib';
import { portfolio } from '@entities/portfolio';
import { formatBattery, type ServerSnapshot } from '@entities/server-status';

// 숨은 터미널의 명령. 화면과 상관없는 일은 여기서 하고, 화면을 바꾸는 일은 TerminalContext 로 부탁함

/** 포트폴리오 페이지에 있는 섹션 */
export const PORTFOLIO_SECTIONS = ['about', 'work', 'projects', 'skills', 'history'] as const;
/** 홈에 있는 섹션 */
export const HOME_SECTIONS = ['server', 'note'] as const;
export const SECTIONS: readonly string[] = [...PORTFOLIO_SECTIONS, ...HOME_SECTIONS];

export interface TerminalContext {
  server: () => ServerSnapshot | null;
  highFive: () => void;
  /** 스탠드를 켜거나 끄고 바뀐 뒤 어두운지 돌려줌 */
  toggleLamp: () => boolean;
  downloadPdf: () => void;
  /** 섹션으로 이동. 터미널은 닫힘 */
  go: (section: string) => void;
  clear: () => void;
  close: () => void;
}

type Command = (args: string[], context: TerminalContext) => string | Promise<string>;

export const isPortfolioSection = (name: string): name is (typeof PORTFOLIO_SECTIONS)[number] => (PORTFOLIO_SECTIONS as readonly string[]).includes(name);

function cat(name: string) {
  if (!SECTIONS.includes(name)) return `cat: ${name}: 그런 파일이 없어요`;
  switch (name) {
    case 'about':
      return portfolio.about.map((item) => `[${item.label}]\n${item.text}`).join('\n\n');
    case 'work':
    case 'projects':
      return portfolio[name].map((item) => `${item.title}  (${item.period})`).join('\n');
    case 'skills':
      return portfolio.skills.map((group) => `${group.label}: ${group.items.join(', ')}`).join('\n');
    case 'history':
      return portfolio.history.map((item) => [item.when, item.what, item.note].filter(Boolean).join(' ')).join('\n');
    default:
      return `${name} 은 화면에서 보는 게 더 재밌어요. cd ${name}`;
  }
}

function neofetch(server: ServerSnapshot | null) {
  if (!server) return '서버 상태를 아직 못 불러왔어요. 잠시 뒤에 다시 해 보세요.';
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
      '쓸 수 있는 명령',
      '  whoami          누구세요',
      '  ls              목록',
      '  cat <이름>       내용 보기 (about, work, projects, skills, history)',
      '  cd <이름>        그 위치로 이동',
      '  neofetch        서버 정보',
      '  curl /api/health 헬스체크',
      '  pdf             포트폴리오 PDF 받기',
      '  hi5             하이파이브 보내기',
      '  lamp            스탠드 켜고 끄기',
      '  date, echo, clear, exit',
    ].join('\n'),
  whoami: () => 'guest (이 방 주인은 gawon)',
  ls: () => `${SECTIONS.join('  ')}  gawon-portfolio.pdf`,
  cat: ([target]) => (target ? cat(target.replace(/\/$/, '')) : 'cat: 무엇을 볼지 적어 주세요. 예) cat about'),
  cd: ([target], context) => {
    const name = (target ?? '').replace(/\/$/, '');
    if (!name || name === '~') return '이미 홈이에요.';
    if (!SECTIONS.includes(name)) return `cd: ${name}: 그런 곳이 없어요`;
    context.go(name);
    return '';
  },
  neofetch: (_, context) => neofetch(context.server()),
  uptime: (_, context) => {
    const server = context.server();
    return server ? `up ${formatDuration(server.uptime)}, load ${server.load.toFixed(2)}` : '아직 몰라요.';
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
  pdf: (_, context) => {
    context.downloadPdf();
    return 'gawon-portfolio.pdf 받는 중';
  },
  hi5,
  highfive: hi5,
  lamp: (_, context) => (context.toggleLamp() ? '스탠드 껐어요.' : '스탠드 켰어요.'),
  date: () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  echo: (args) => args.join(' '),
  clear,
  cls: clear,
  exit,
  quit: exit,
  sudo: () => 'guest is not in the sudoers file. This incident will be reported.',
  rm: () => 'rm: 여기 제 방이에요. 지우지 말아 주세요.',
  ssh: () => 'Permission denied (publickey).',
  vim,
  vi: vim,
  nano: vim,
  git: (args) => (args[0] === 'push' ? 'main 에 push 하면 진짜 배포돼요. 여기서는 참을게요.' : `git ${args.join(' ')}: 여기서는 안 돼요`),
};

/** 한 줄을 실행해 출력할 글을 돌려줌. 없는 명령이면 dim 으로 표시 */
export async function runCommand(line: string, context: TerminalContext): Promise<{ text: string; known: boolean } | null> {
  const [name, ...args] = line.trim().split(/\s+/);
  if (!name) return null;
  const command = COMMANDS[name.toLowerCase()];
  if (!command) return { text: `command not found: ${name}. help 를 입력해 보세요.`, known: false };
  return { text: await command(args, context), known: true };
}

/** Tab 자동 완성. 첫 단어는 명령, 그 뒤는 섹션 이름 */
export function complete(value: string) {
  const [name = '', ...rest] = value.split(' ');
  const pool = rest.length ? SECTIONS : Object.keys(COMMANDS);
  const word = rest.length ? (rest.at(-1) ?? '') : name;
  const match = word ? pool.find((candidate) => candidate.startsWith(word)) : undefined;
  if (!match) return value;
  return rest.length ? [name, ...rest.slice(0, -1), match].join(' ') : `${match} `;
}
