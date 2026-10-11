// 페이지 동작. API 가 실패해도 본문은 그대로 보이게 둠
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const api = {
  async get(path) {
    const res = await fetch(`/api${path}`);
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return res.json();
  },
  post(path, body) {
    return fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  },
};

// 브라우저 저장소는 막혀 있을 수 있으니 실패해도 넘어감
const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

const number = (n) => n.toLocaleString('ko-KR');

/* 스탠드: 끄면 어두운 테마 */
const lamp = $('#lamp');
const lampText = $('#lamp-text');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => {
  const theme = document.documentElement.dataset.theme;
  return theme ? theme === 'dark' : darkQuery.matches;
};
function syncLamp() {
  const dark = isDark();
  lamp.setAttribute('aria-pressed', String(!dark));
  lampText.textContent = dark ? '스탠드 켜기' : '스탠드 끄기';
}
function toggleLamp() {
  const dark = !isDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  store.set('lamp', dark ? 'off' : 'on');
  syncLamp();
}
lamp.addEventListener('click', toggleLamp);
darkQuery.addEventListener('change', syncLamp);
syncLamp();

/* 메일 주소 복사 */
const copyButton = $('#copy-email');
copyButton.addEventListener('click', async () => {
  const text = copyButton.dataset.copy;
  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = '복사됨';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(copyButton.previousElementSibling);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    copyButton.textContent = '선택됨';
  }
  setTimeout(() => (copyButton.textContent = '복사'), 1600);
});

/* 노트북 스티커 끌어서 옮기기. 위치는 이 브라우저에만 저장 */
const lid = $('#lid');
const stickers = $$('.sticker', lid);
const defaults = new Map(
  stickers.map((el) => [el.dataset.sticker, { x: el.style.getPropertyValue('--x'), y: el.style.getPropertyValue('--y') }]),
);
const place = (el, { x, y }) => {
  el.style.setProperty('--x', x);
  el.style.setProperty('--y', y);
};
const savedStickers = store.get('stickers') ?? {};
for (const el of stickers) {
  if (savedStickers[el.dataset.sticker]) place(el, savedStickers[el.dataset.sticker]);
}

let drag = null;
let topLayer = 10;
lid.addEventListener('pointerdown', (event) => {
  const el = event.target.closest('.sticker');
  if (!el || event.button !== 0) return;
  event.preventDefault();
  const box = lid.getBoundingClientRect();
  drag = {
    el,
    box,
    dx: event.clientX - box.left - el.offsetLeft,
    dy: event.clientY - box.top - el.offsetTop,
  };
  el.setPointerCapture(event.pointerId);
  el.style.zIndex = String(++topLayer);
  el.classList.add('is-lifted');
});
lid.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const { el, box, dx, dy } = drag;
  // 스티커가 뚜껑 밖으로 반쯤 넘어가는 것까지는 허용
  const maxX = box.width - el.offsetWidth / 2;
  const maxY = box.height - el.offsetHeight / 2;
  const left = Math.min(Math.max(event.clientX - box.left - dx, -el.offsetWidth / 2), maxX);
  const top = Math.min(Math.max(event.clientY - box.top - dy, -el.offsetHeight / 2), maxY);
  place(el, { x: `${((left / box.width) * 100).toFixed(2)}%`, y: `${((top / box.height) * 100).toFixed(2)}%` });
});
const drop = () => {
  if (!drag) return;
  drag.el.classList.remove('is-lifted');
  drag = null;
  const positions = {};
  for (const el of stickers) {
    positions[el.dataset.sticker] = { x: el.style.getPropertyValue('--x'), y: el.style.getPropertyValue('--y') };
  }
  store.set('stickers', positions);
};
lid.addEventListener('pointerup', drop);
lid.addEventListener('pointercancel', drop);

$('#sticker-reset').addEventListener('click', () => {
  for (const el of stickers) {
    place(el, defaults.get(el.dataset.sticker));
    el.style.zIndex = '';
  }
  store.set('stickers', null);
});

/* 서버 상태: 노트북 LED, 캡션, 영수증 */
const led = $('#led');
const heroStatus = $('#hero-status');
const receipt = {
  commit: $('#r-commit'),
  deployed: $('#r-deployed'),
  uptime: $('#r-uptime'),
  temp: $('#r-temp'),
  load: $('#r-load'),
  spark: $('#r-spark polyline'),
  mem: $('#r-mem'),
  battery: $('#r-battery'),
  ping: $('#r-ping'),
  visits: $('#r-visits'),
};
const loads = [];
let lastStatus = null;

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}일 ${hours}시간`;
  if (hours) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

function formatDeployedAt(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatBattery(battery) {
  if (!battery) return '없음';
  if (battery.charging) return `${battery.percent}% 충전 중`;
  if (battery.pluggedIn === false) return `${battery.percent}% 배터리로 버티는 중`;
  if (battery.pluggedIn) return `${battery.percent}% 전원 연결`;
  return `${battery.percent}%`;
}

function drawSpark() {
  if (loads.length < 2) return;
  const max = Math.max(...loads, 0.5);
  const step = 60 / (loads.length - 1);
  const points = loads.map((value, i) => `${(i * step).toFixed(1)},${(15 - (value / max) * 14).toFixed(1)}`);
  receipt.spark.setAttribute('points', points.join(' '));
}

async function refreshServer() {
  const started = performance.now();
  try {
    const status = await api.get('/server');
    const ping = Math.round(performance.now() - started);
    lastStatus = { ...status, ping };
    loads.push(status.load);
    if (loads.length > 30) loads.shift();

    led.dataset.state = 'on';
    const bits = [`켜진 지 ${formatUptime(status.uptime)}`];
    if (status.cpuTemp !== null) bits.push(`CPU ${status.cpuTemp}°C`);
    if (status.battery) bits.push(`배터리 ${status.battery.percent}%`);
    heroStatus.textContent = `이 페이지를 보내는 집 노트북 / ${bits.join(' / ')}`;

    receipt.commit.textContent = status.release ? status.release.commit : '로컬 실행';
    receipt.deployed.textContent = status.release?.deployedAt ? formatDeployedAt(status.release.deployedAt) : '-';
    receipt.uptime.textContent = formatUptime(status.uptime);
    receipt.temp.textContent = status.cpuTemp === null ? '센서 없음' : `${status.cpuTemp}°C`;
    receipt.load.textContent = status.load.toFixed(2);
    receipt.mem.textContent = `${status.memoryUsedPercent}%`;
    receipt.battery.textContent = formatBattery(status.battery);
    receipt.ping.textContent = `${ping}ms`;
    drawSpark();
  } catch {
    lastStatus = null;
    led.dataset.state = 'off';
    heroStatus.textContent = '서버 상태를 불러오지 못했어요. 페이지는 그대로 볼 수 있어요.';
    receipt.commit.textContent = '응답 없음';
  }
}
refreshServer();
setInterval(() => {
  if (document.visibilityState === 'visible') refreshServer();
}, 10_000);

/* 방문 수 */
const viewCount = $('#view-count');
let visits = null;
api
  .post('/views')
  .then((res) => (res.ok ? res.json() : Promise.reject(res)))
  .then(({ total }) => {
    visits = total;
    viewCount.textContent = ` / 방문 ${number(total)}`;
    viewCount.hidden = false;
    receipt.visits.textContent = number(total);
  })
  .catch(() => {});

/* 하이파이브: 연타를 모아서 한 번에 보냄 */
const hi5 = $('#hi5');
const hi5Total = $('#hi5-total');
const hi5Status = $('#hi5-status');
let hi5Shown = null;
let hi5Pending = 0;
let hi5Timer = null;
const CLAPS = ['짝!', '짝짝!', '짝!', '나이스', '짝!'];

const showHi5 = (total) => {
  hi5Shown = total;
  hi5Total.textContent = number(total);
};
api.get('/high-fives').then(({ total }) => showHi5(total)).catch(() => {});

function popClap() {
  hi5.classList.add('is-pressed');
  setTimeout(() => hi5.classList.remove('is-pressed'), 90);
  if (reduceMotion) return;
  const clap = document.createElement('span');
  clap.className = 'clap';
  clap.setAttribute('aria-hidden', 'true');
  clap.textContent = CLAPS[Math.floor(Math.random() * CLAPS.length)];
  clap.style.setProperty('--dx', `${Math.round(Math.random() * 60 - 30)}px`);
  clap.style.setProperty('--rot', `${Math.round(Math.random() * 30 - 15)}deg`);
  clap.addEventListener('animationend', () => clap.remove());
  hi5.append(clap);
}

async function flushHi5() {
  const count = hi5Pending;
  hi5Pending = 0;
  if (!count) return;
  try {
    const res = await api.post('/high-fives', { count });
    if (res.status === 429) {
      showHi5((hi5Shown ?? count) - count);
      hi5Status.textContent = '너무 빨라요. 조금 쉬었다가 다시 눌러 주세요.';
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const { total, accepted } = await res.json();
    showHi5(total);
    hi5Status.textContent = accepted < count ? '오늘은 충분히 받았어요. 내일 또 눌러 주세요.' : '';
  } catch {
    hi5Status.textContent = '지금은 전달이 안 돼요. 잠시 뒤에 다시 눌러 주세요.';
  }
}

function giveHighFive() {
  if (hi5Pending >= 10) return;
  hi5Pending += 1;
  showHi5((hi5Shown ?? 0) + 1);
  popClap();
  clearTimeout(hi5Timer);
  hi5Timer = setTimeout(flushHi5, 600);
}
hi5.addEventListener('click', giveHighFive);

/* 쪽지(엽서) */
const form = $('#contact-form');
const formStatus = $('#form-status');
const postmarkDate = $('#postmark-date');
const FALLBACK = '지금은 보낼 수 없어요. 메일로 연락해 주세요.';
const STATUS_TEXT = {
  201: '보냈어요. 남겨 주셔서 고맙습니다.',
  400: '입력한 내용을 다시 확인해 주세요. 메시지는 5자 이상이어야 해요.',
  429: '잠시 뒤에 다시 보내 주세요.',
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const button = $('button[type="submit"]', form);
  button.disabled = true;
  formStatus.dataset.state = '';
  formStatus.textContent = '보내는 중...';
  try {
    const res = await api.post('/messages', Object.fromEntries(new FormData(form)));
    formStatus.textContent = STATUS_TEXT[res.status] ?? FALLBACK;
    formStatus.dataset.state = res.ok ? 'ok' : 'error';
    if (res.ok) {
      form.reset();
      postmarkDate.textContent = formatDeployedAt(new Date().toISOString()).slice(0, 10);
      form.classList.add('is-sent');
    }
  } catch {
    formStatus.textContent = FALLBACK;
    formStatus.dataset.state = 'error';
  } finally {
    button.disabled = false;
  }
});
form.addEventListener('input', () => form.classList.remove('is-sent'));

/* 숨은 터미널. ` 키나 아래쪽 버튼으로 열기 */
const term = $('#term');
const termOut = $('#term-out');
const termInput = $('#term-input');
const termBody = $('#term-body');
const termHistory = [];
let historyIndex = 0;

function write(text, tone = '') {
  const line = document.createElement('div');
  if (tone) line.className = tone;
  line.textContent = text;
  termOut.append(line);
  termBody.scrollTop = termBody.scrollHeight;
}

const SECTIONS = ['about', 'work', 'projects', 'skills', 'history', 'server', 'note'];
const textOf = (el) => el.textContent.replace(/\s+/g, ' ').trim();

function catSection(name) {
  const section = $(`#${name}`);
  if (!section) return `cat: ${name}: 그런 파일이 없어요`;
  if (name === 'about') {
    return $$('[data-pdf="about-item"]', section)
      .map((item) => `[${textOf($('[data-pdf="label"]', item))}]\n${textOf($('[data-pdf="text"]', item))}`)
      .join('\n\n');
  }
  if (name === 'work' || name === 'projects') {
    return $$('[data-pdf="work"], [data-pdf="project"]', section)
      .map((item) => `${textOf($('[data-pdf="title"]', item))}  (${textOf($('[data-pdf="period"]', item))})`)
      .join('\n');
  }
  if (name === 'skills') {
    return $$('[data-pdf="skill-group"]', section)
      .map((group) => `${textOf($('[data-pdf="label"]', group))}: ${$$('li', group).map(textOf).join(', ')}`)
      .join('\n');
  }
  if (name === 'history') {
    return $$('li', section).map((li) => textOf(li)).join('\n');
  }
  return `${name} 은 화면에서 보는 게 더 재밌어요. cd ${name}`;
}

function neofetch() {
  if (!lastStatus) return '서버 상태를 아직 못 불러왔어요. 잠시 뒤에 다시 해 보세요.';
  const s = lastStatus;
  const art = [
    '  .------------.',
    '  |  gawon-dev |',
    '  |    [==]    |',
    '  |         o  |',
    "  '------------'",
    '                ',
    '                ',
    '                ',
  ];
  const info = [
    'guest@gawon-dev',
    '---------------',
    'Host: 집에 있는 노트북',
    `Uptime: ${formatUptime(s.uptime)}`,
    `CPU: ${s.cores}코어${s.cpuTemp === null ? '' : `, ${s.cpuTemp}°C`}`,
    `Load: ${s.load.toFixed(2)}`,
    `Memory: ${s.memoryUsedPercent}%`,
    `Battery: ${formatBattery(s.battery)}`,
  ];
  return info.map((line, i) => `${art[i]}   ${line}`).join('\n');
}

function closeTerm() {
  if (term.open) term.close();
}

const COMMANDS = {
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
  cat: (args) => (args[0] ? catSection(args[0].replace(/\/$/, '')) : 'cat: 무엇을 볼지 적어 주세요. 예) cat about'),
  cd: (args) => {
    const name = (args[0] ?? '').replace(/\/$/, '');
    if (!name || name === '~') return '이미 홈이에요.';
    if (!SECTIONS.includes(name)) return `cd: ${name}: 그런 곳이 없어요`;
    closeTerm();
    $(`#${name}`).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    return '';
  },
  neofetch,
  uptime: () => (lastStatus ? `up ${formatUptime(lastStatus.uptime)}, load ${lastStatus.load.toFixed(2)}` : '아직 몰라요.'),
  curl: async (args) => {
    const target = args.find((a) => a.startsWith('/api/'));
    if (!['/api/health', '/api/server', '/api/views', '/api/high-fives'].includes(target)) {
      return 'curl: 여기서는 /api/health, /api/server, /api/views, /api/high-fives 만 돼요';
    }
    try {
      const res = await fetch(target);
      return `HTTP ${res.status}\n${JSON.stringify(await res.json(), null, 2)}`;
    } catch {
      return 'curl: 서버에 닿지 않았어요';
    }
  },
  pdf: () => {
    $('#pdf-link').click();
    return 'gawon-portfolio.pdf 받는 중';
  },
  hi5: () => {
    giveHighFive();
    return '짝! 하이파이브 보냈어요.';
  },
  lamp: () => {
    toggleLamp();
    return isDark() ? '스탠드 껐어요.' : '스탠드 켰어요.';
  },
  date: () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  echo: (args) => args.join(' '),
  clear: () => {
    termOut.replaceChildren();
    return '';
  },
  exit: () => {
    closeTerm();
    return '';
  },
  sudo: () => 'guest is not in the sudoers file. This incident will be reported.',
  rm: () => 'rm: 여기 제 방이에요. 지우지 말아 주세요.',
  ssh: () => 'Permission denied (publickey).',
  vim: () => '에디터는 없어요. 나가는 법을 몰라도 괜찮아요.',
  git: (args) => (args[0] === 'push' ? 'main 에 push 하면 진짜 배포돼요. 여기서는 참을게요.' : `git ${args.join(' ')}: 여기서는 안 돼요`),
};
COMMANDS.vi = COMMANDS.vim;
COMMANDS.nano = COMMANDS.vim;
COMMANDS.cls = COMMANDS.clear;
COMMANDS.quit = COMMANDS.exit;
COMMANDS.highfive = COMMANDS.hi5;

async function run(line) {
  const [name, ...args] = line.trim().split(/\s+/);
  if (!name) return;
  const command = COMMANDS[name.toLowerCase()];
  const result = command ? await command(args) : `command not found: ${name}. help 를 입력해 보세요.`;
  if (result) write(result, command ? '' : 't-dim');
}

$('#term-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const line = termInput.value;
  termInput.value = '';
  write(`guest@gawon-dev:~$ ${line}`, 't-cmd');
  if (line.trim()) {
    termHistory.push(line);
    historyIndex = termHistory.length;
  }
  await run(line);
});

termInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp' && historyIndex > 0) {
    event.preventDefault();
    termInput.value = termHistory[--historyIndex];
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.min(historyIndex + 1, termHistory.length);
    termInput.value = termHistory[historyIndex] ?? '';
  } else if (event.key === 'Tab') {
    event.preventDefault();
    const [name, ...rest] = termInput.value.split(' ');
    const pool = rest.length ? SECTIONS : Object.keys(COMMANDS);
    const word = rest.length ? rest[rest.length - 1] : name;
    const match = pool.find((candidate) => candidate.startsWith(word) && word);
    if (match) termInput.value = rest.length ? [name, ...rest.slice(0, -1), match].join(' ') : `${match} `;
  }
});

let termGreeted = false;
function openTerm() {
  if (term.open) return;
  term.showModal();
  if (!termGreeted) {
    termGreeted = true;
    write('gawon-dev 에 오신 걸 환영해요. help 를 입력하면 쓸 수 있는 명령이 나와요.', 't-ok');
  }
  termInput.focus();
}
$('#term-open').addEventListener('click', openTerm);
$('#term-close').addEventListener('click', closeTerm);
term.addEventListener('click', (event) => {
  if (event.target === term) closeTerm();
});
document.addEventListener('keydown', (event) => {
  const typing = event.target.closest('input, textarea, [contenteditable]');
  if (event.key === '`' && !typing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    openTerm();
  }
});
