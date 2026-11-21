// 숨은 터미널의 tree 이스터에그. 글자로 그린 크리스마스 트리가 제자리에서 돌고, 전구가 반짝이고, 눈이 내림
// 원뿔 표면의 각 칸이 지금 몇 도를 보고 있는지 계산해 무늬, 전구, 장식을 돌림. 화면에 그리는 일은 christmas-tree.tsx 가 함

export interface TreeCell {
  x: number;
  y: number;
  ch: string;
  color: string;
  /** 0 이면 그냥, 크면 그만큼 번지는 빛 */
  glow: number;
}

const TAU = Math.PI * 2;
const NEEDLES = '.,:-=+*#%@';
const SPARKLE_COLORS = ['#ffffff', '#fff3b0', '#ffd54a', '#bfe8ff'];
const ORNAMENT_COLORS = ['#ff4d5e', '#ffd54a', '#5ec8ff', '#ff8ad8', '#b388ff', '#ffffff'];
const TEXT_COLORS = ['#ff4d5e', '#6be38b', '#ffd54a'];
const GREETING = 'MERRY CHRISTMAS';
const SPIN = 0.9;

/** 0 이상 1 미만의 고정된 난수. 같은 n 이면 늘 같은 값이라 프레임마다 깜빡이지 않음 */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function treeFrame(cols: number, rows: number, time: number): TreeCell[] {
  const cells = new Map<number, TreeCell>();
  const put = (x: number, y: number, ch: string, color: string, glow = 0) => {
    const cx = Math.round(x);
    if (cx < 0 || y < 0 || cx >= cols || y >= rows) return;
    cells.set(y * cols + cx, { x: cx, y, ch, color, glow });
  };

  // 눈. 트리보다 먼저 그려서 트리 뒤로 지나감
  const flakes = Math.round((cols * rows) / 45);
  for (let i = 0; i < flakes; i++) {
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
  const spin = time * SPIN;
  const radiusAt = (h: number) => halfWidth * h * (0.78 + 0.22 * ((h * 5) % 1));

  for (let row = 0; row < height; row++) {
    const h = (row + 1) / height;
    const radius = radiusAt(h);
    const y = top + row;

    // 잎. 무늬가 트리 표면에 붙어서 같이 돌고, 정면일수록 밝음. 군데군데 반짝이가 붙어 있음
    const span = Math.round(radius);
    for (let dx = -span; dx <= span; dx++) {
      const u = dx / Math.max(radius, 0.5);
      if (Math.abs(u) > 1) continue;
      const facing = Math.sqrt(1 - u * u);
      const surface = Math.asin(u) - spin;
      const seed = Math.floor((surface / TAU) * 40) * 13 + row * 7.3;
      const needle = hash(seed);
      const sparkle = hash(seed + 0.37) > 0.93 ? Math.sin(time * 6 + seed * 20) : -1;
      if (sparkle > 0.55 && facing > 0.3) {
        put(center + dx, y, '*', SPARKLE_COLORS[Math.floor(hash(seed + 0.9) * SPARKLE_COLORS.length)] ?? '#ffffff', 7);
        continue;
      }
      const light = Math.min(0.99, 0.1 + 0.48 * facing + 0.42 * needle);
      const ch = NEEDLES[Math.floor(light * NEEDLES.length)] ?? '#';
      put(center + dx, y, ch, `hsl(${Math.round(118 + needle * 30)}, ${Math.round(50 + needle * 22)}%, ${Math.round(11 + light * 36)}%)`);
    }

    // 나선 두 줄로 감은 전구. 색이 무지개처럼 흘러가고 하나씩 깜빡임
    for (let strand = 0; strand < 2; strand++) {
      const angle = h * 3.2 * TAU + strand * Math.PI + spin;
      const depth = Math.cos(angle);
      if (depth <= 0.05) continue;
      const on = Math.sin(time * 4 + row * 1.7 + strand * 2) > -0.35;
      const hue = Math.round((row * 24 + time * 110 + strand * 180) % 360);
      put(center + Math.sin(angle) * radius, y, on ? 'o' : '*', `hsl(${hue}, 95%, ${on ? 64 : 42}%)`, on ? Math.round(6 + depth * 8) : 0);
    }
  }

  // 장식 공. 트리 표면에 붙어서 같이 돌고, 뒤로 넘어가면 안 보임
  const ornaments = Math.max(12, Math.round(height * 1.2));
  for (let i = 0; i < ornaments; i++) {
    const h = 0.18 + hash(i * 3.1) * 0.8;
    const angle = hash(i * 7.7) * TAU + spin;
    const depth = Math.cos(angle);
    if (depth < 0.2) continue;
    const row = Math.min(height - 1, Math.round(h * height) - 1);
    const twinkle = 0.6 + 0.4 * Math.sin(time * 3 + i);
    const color = ORNAMENT_COLORS[i % ORNAMENT_COLORS.length] ?? '#ffffff';
    put(center + Math.sin(angle) * radiusAt(h) * 0.9, top + row, twinkle > 0.75 ? '@' : 'O', color, Math.round(4 + depth * 10 * twinkle));
  }

  // 꼭대기 별. 세 줄짜리 빛줄기가 번갈아 반짝임
  const starX = Math.round(center);
  const flash = Math.sin(time * 5) > 0;
  const ray = flash ? '#fff3b0' : '#ffd54a';
  put(starX, 1, '*', '#ffe27a', 22);
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

  // 줄기
  for (let row = 0; row < 2; row++) {
    for (let dx = -1; dx <= 1; dx++) put(center + dx, top + height + row, '#', '#9a6a43');
  }

  // 인사말. 글자마다 색이 돌아가며 바뀜
  const startX = Math.round(center - (GREETING.length - 1) / 2);
  [...GREETING].forEach((ch, index) => {
    if (ch === ' ') return;
    const color = TEXT_COLORS[(index + Math.floor(time * 3)) % TEXT_COLORS.length] ?? '#ffffff';
    put(startX + index, rows - 1, ch, color, 8);
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
