// 숨은 터미널의 tree 이스터에그. 글자로 그린 크리스마스 트리가 처음부터 만들어진 뒤 제자리에서 돌고, 전구가 반짝이고, 눈이 내림
// 원뿔 표면의 각 칸이 지금 몇 도를 보고 있는지 계산해 무늬, 전구, 장식을 돌림. 화면에 그리는 일은 christmas-tree.tsx 가 함
//
// 처음 4.5초는 만들어지는 장면 (time 은 tree 를 친 뒤 흐른 초)
//   0.0 ~ 0.4  줄기가 섬
//   0.3 ~ 2.0  잎이 아래에서 위로 한 줄씩 자람. 줄마다 가운데부터 퍼지며 코드 글자가 흐르다 잎으로 굳음
//   1.7 ~ 2.9  전구 줄이 위에서 아래로 감김. 감기는 끝이 하얗게 빛남
//   2.4 ~ 3.3  장식 공이 번쩍이며 하나씩 달림
//   3.1 ~ 3.9  별이 떨어져 꽂히고 빛이 원으로 퍼짐
//   3.6 ~ 4.5  인사말이 한 글자씩 찍힘. 눈은 처음부터 조금씩 늘어남

export interface TreeCell {
  x: number;
  y: number;
  ch: string;
  color: string;
  /** 0 이면 그냥, 크면 그만큼 번지는 빛 */
  glow: number;
}

/** 만들어지는 장면이 끝나는 시각(초). 움직임을 줄이는 설정이면 이 뒤의 한 장만 그림 */
export const TREE_INTRO_SECONDS = 4.5;

const TAU = Math.PI * 2;
const NEEDLES = '.,:-=+*#%@';
const CODE = '01{}[]<>/;:=+*#$%&';
const SPARKLE_COLORS = ['#ffffff', '#fff3b0', '#ffd54a', '#bfe8ff'];
const ORNAMENT_COLORS = ['#ff4d5e', '#ffd54a', '#5ec8ff', '#ff8ad8', '#b388ff', '#ffffff'];
const TEXT_COLORS = ['#ff4d5e', '#6be38b', '#ffd54a'];
const GREETING = 'MERRY CHRISTMAS';
const SPIN = 0.9;

const TRUNK_AT = 0;
const LEAVES_FROM = 0.3;
const LEAVES_TO = 2.0;
/** 한 줄이 가운데부터 끝까지 퍼지는 데 걸리는 시간 */
const ROW_SPREAD = 0.28;
/** 퍼진 칸이 코드 글자로 흐르다 잎으로 굳기까지 */
const DECODE = 0.35;
const LIGHTS_FROM = 1.7;
const LIGHTS_TO = 2.9;
const ORNAMENTS_FROM = 2.4;
const ORNAMENTS_TO = 3.3;
const STAR_DROP = 3.1;
const STAR_LAND = 3.45;
const TEXT_FROM = 3.6;
const TEXT_STEP = 0.06;

/** 0 이상 1 미만의 고정된 난수. 같은 n 이면 늘 같은 값이라 프레임마다 깜빡이지 않음 */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const pick = <T>(list: readonly T[], value: number) => list[Math.floor(value * list.length) % list.length] as T;

export function treeFrame(cols: number, rows: number, time: number): TreeCell[] {
  const cells = new Map<number, TreeCell>();
  const put = (x: number, y: number, ch: string, color: string, glow = 0) => {
    const cx = Math.round(x);
    if (cx < 0 || y < 0 || cx >= cols || y >= rows) return;
    cells.set(y * cols + cx, { x: cx, y, ch, color, glow });
  };

  // 눈. 트리보다 먼저 그려서 트리 뒤로 지나감. 처음에는 몇 송이만 내리다 늘어남
  const flakes = Math.round((cols * rows) / 45);
  const snowAmount = clamp01(0.15 + time / 3);
  for (let i = 0; i < flakes; i++) {
    if (hash(i + 0.11) > snowAmount) continue;
    const size = hash(i + 0.75);
    const speed = 1.2 + hash(i) * 2.2;
    const y = Math.floor((hash(i + 0.5) * rows + time * speed) % rows);
    const x = hash(i + 0.25) * cols + Math.sin(time * 0.7 + i) * 1.4;
    put(x, y, size > 0.85 ? '*' : size > 0.5 ? '+' : '.', `rgba(235, 242, 255, ${(0.3 + size * 0.55).toFixed(2)})`);
  }

  // 자리 잡기: 위 3줄은 별, 아래는 줄기 2줄, 빈 줄, 인사말
  const top = 3;
  const height = Math.max(6, rows - top - 5);
  const halfWidth = Math.min(cols * 0.44, height * 1.2);
  const center = (cols - 1) / 2;
  // 만들어지는 동안은 감기듯 빠르게 돌다가 평소 속도로 내려옴
  const spin = time * SPIN + 3 * (1 - Math.exp(-time / 1.2));
  const radiusAt = (h: number) => halfWidth * h * (0.78 + 0.22 * ((h * 5) % 1));
  /** 이 줄이 나타나기 시작하는 시각. 맨 아래 줄부터 */
  const rowStart = (row: number) => LEAVES_FROM + ((height - 1 - row) / Math.max(1, height - 1)) * (LEAVES_TO - LEAVES_FROM - ROW_SPREAD);
  const lightsDrawn = clamp01((time - LIGHTS_FROM) / (LIGHTS_TO - LIGHTS_FROM));

  // 줄기. 맨 먼저 섬
  for (let row = 0; row < 2; row++) {
    if (time < TRUNK_AT + (1 - row) * 0.2) continue;
    for (let dx = -1; dx <= 1; dx++) put(center + dx, top + height + row, '#', '#9a6a43');
  }

  for (let row = 0; row < height; row++) {
    const grown = time - rowStart(row);
    if (grown < 0) continue;
    const h = (row + 1) / height;
    const radius = radiusAt(h);
    const y = top + row;

    // 잎. 무늬가 트리 표면에 붙어서 같이 돌고, 정면일수록 밝음. 군데군데 반짝이가 붙어 있음
    const span = Math.round(radius);
    const reach = clamp01(grown / ROW_SPREAD) * (span + 1);
    for (let dx = -span; dx <= span; dx++) {
      if (Math.abs(dx) > reach) continue;
      const u = dx / Math.max(radius, 0.5);
      if (Math.abs(u) > 1) continue;
      const facing = Math.sqrt(1 - u * u);
      const surface = Math.asin(u) - spin;
      const seed = Math.floor((surface / TAU) * 40) * 13 + row * 7.3;

      // 막 퍼진 칸은 코드 글자가 빠르게 바뀌다가 굳음
      const settleAt = (Math.abs(dx) / Math.max(span, 1)) * ROW_SPREAD + hash(dx * 3.7 + row * 11.3) * DECODE;
      if (grown < settleAt) {
        const flicker = hash(dx * 1.3 + row * 5.1 + Math.floor(time * 24));
        put(center + dx, y, pick([...CODE], flicker), flicker > 0.8 ? '#eafff0' : `hsl(140, 85%, ${Math.round(55 + flicker * 25)}%)`, 6);
        continue;
      }

      const needle = hash(seed);
      const sparkle = hash(seed + 0.37) > 0.93 ? Math.sin(time * 6 + seed * 20) : -1;
      if (sparkle > 0.55 && facing > 0.3) {
        put(center + dx, y, '*', pick(SPARKLE_COLORS, hash(seed + 0.9)), 7);
        continue;
      }
      const light = Math.min(0.99, 0.1 + 0.48 * facing + 0.42 * needle);
      const ch = NEEDLES[Math.floor(light * NEEDLES.length)] ?? '#';
      put(center + dx, y, ch, `hsl(${Math.round(118 + needle * 30)}, ${Math.round(50 + needle * 22)}%, ${Math.round(11 + light * 36)}%)`);
    }

    // 나선 두 줄로 감은 전구. 위에서부터 감기고, 다 감기면 색이 무지개처럼 흘러가며 하나씩 깜빡임
    if (h > lightsDrawn) continue;
    const isTip = lightsDrawn < 1 && h > lightsDrawn - 1.5 / height;
    for (let strand = 0; strand < 2; strand++) {
      const angle = h * 3.2 * TAU + strand * Math.PI + spin;
      const depth = Math.cos(angle);
      if (depth <= 0.05) continue;
      const x = center + Math.sin(angle) * radius;
      if (isTip) {
        put(x, y, '@', '#ffffff', 18);
        continue;
      }
      const on = Math.sin(time * 4 + row * 1.7 + strand * 2) > -0.35;
      const hue = Math.round((row * 24 + time * 110 + strand * 180) % 360);
      put(x, y, on ? 'o' : '*', `hsl(${hue}, 95%, ${on ? 64 : 42}%)`, on ? Math.round(6 + depth * 8) : 0);
    }
  }

  // 장식 공. 트리 표면에 붙어서 같이 돌고, 뒤로 넘어가면 안 보임. 달리는 순간 하얗게 번쩍임
  const ornaments = Math.max(12, Math.round(height * 1.2));
  for (let i = 0; i < ornaments; i++) {
    const hangAt = ORNAMENTS_FROM + hash(i * 1.9) * (ORNAMENTS_TO - ORNAMENTS_FROM - 0.2);
    if (time < hangAt) continue;
    const h = 0.18 + hash(i * 3.1) * 0.8;
    const angle = hash(i * 7.7) * TAU + spin;
    const depth = Math.cos(angle);
    if (depth < 0.2) continue;
    const row = Math.min(height - 1, Math.round(h * height) - 1);
    const x = center + Math.sin(angle) * radiusAt(h) * 0.9;
    if (time - hangAt < 0.18) {
      put(x, top + row, 'O', '#ffffff', 22);
      continue;
    }
    const twinkle = 0.6 + 0.4 * Math.sin(time * 3 + i);
    put(x, top + row, twinkle > 0.75 ? '@' : 'O', pick(ORNAMENT_COLORS, i / ORNAMENT_COLORS.length), Math.round(4 + depth * 10 * twinkle));
  }

  // 꼭대기 별. 위에서 떨어져 꽂히면 빛이 원으로 퍼지고, 그 뒤로는 세 줄짜리 빛줄기가 번갈아 반짝임
  const starX = Math.round(center);
  if (time >= STAR_DROP && time < STAR_LAND) {
    const fall = (time - STAR_DROP) / (STAR_LAND - STAR_DROP);
    const y = Math.round(-2 + fall * fall * 3);
    put(starX, y, '*', '#ffe27a', 22);
    put(starX, y - 1, '|', 'rgba(255, 226, 122, 0.5)', 6);
  } else if (time >= STAR_LAND) {
    const burst = time - STAR_LAND;
    if (burst < 0.6) {
      const radius = burst * 18;
      for (let k = 0; k < 20; k++) {
        const angle = (k / 20) * TAU;
        const y = Math.round(1 + Math.sin(angle) * radius * 0.5);
        if (y < 0) continue;
        put(starX + Math.cos(angle) * radius, y, k % 2 ? '*' : '+', `rgba(255, 230, 140, ${(1 - burst / 0.6).toFixed(2)})`, 10);
      }
    }
    const flash = Math.sin(time * 5) > 0 || burst < 0.4;
    const ray = flash ? '#fff3b0' : '#ffd54a';
    put(starX, 1, '*', '#ffe27a', burst < 0.4 ? 34 : 22);
    put(starX - 1, 1, '=', '#ffd54a', 12);
    put(starX + 1, 1, '=', '#ffd54a', 12);
    put(starX - 2, 1, flash ? '-' : ' ', ray, 8);
    put(starX + 2, 1, flash ? '-' : ' ', ray, 8);
    put(starX, 0, '|', ray, 10);
    put(starX, 2, '|', ray, 10);
    put(starX - 1, 0, flash ? '\\' : '.', ray, 8);
    put(starX + 1, 0, flash ? '/' : '.', ray, 8);
    put(starX - 1, 2, flash ? '/' : '.', ray, 8);
    put(starX + 1, 2, flash ? '\\' : '.', ray, 8);
  }

  // 인사말. 한 글자씩 찍히고, 다 찍히면 글자마다 색이 돌아가며 바뀜
  const typed = Math.floor((time - TEXT_FROM) / TEXT_STEP);
  const startX = Math.round(center - (GREETING.length - 1) / 2);
  [...GREETING].forEach((ch, index) => {
    if (ch === ' ' || index > typed) return;
    const fresh = index === typed;
    const color = fresh ? '#ffffff' : pick(TEXT_COLORS, ((index + Math.floor(time * 3)) % TEXT_COLORS.length) / TEXT_COLORS.length);
    put(startX + index, rows - 1, ch, color, fresh ? 14 : 8);
  });

  return [...cells.values()];
}

/** 트리를 끌 때 남기는 한 줄. 서울 기준 오늘부터 12월 25일까지 */
export function christmasCountdown(now = new Date()) {
  const seoul = new Date(now.getTime() + 9 * 3600_000);
  const year = seoul.getUTCFullYear();
  const today = Date.UTC(year, seoul.getUTCMonth(), seoul.getUTCDate());
  let christmas = Date.UTC(year, 11, 25);
  if (today > christmas) christmas = Date.UTC(year + 1, 11, 25);
  const days = Math.round((christmas - today) / 86400_000);
  return days === 0 ? 'Merry Christmas! 오늘이 크리스마스예요.' : `Merry Christmas! 크리스마스까지 D-${days}`;
}

/** 12월 1일부터 25일까지는 터미널 첫인사에 tree 를 슬쩍 알려 줌 */
export function isChristmasSeason(now = new Date()) {
  const seoul = new Date(now.getTime() + 9 * 3600_000);
  return seoul.getUTCMonth() === 11 && seoul.getUTCDate() <= 25;
}
