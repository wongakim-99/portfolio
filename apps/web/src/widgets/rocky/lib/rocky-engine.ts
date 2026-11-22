// 로키 공을 빈 책상 위에서 굴리는 엔진. 화면을 그리는 React 와 떨어져서 좌표와 타이머만 다룸 (서버 구성도 엔진과 같은 방식)
// 공은 화면에 고정(position: fixed)이고, 종이나 카드가 없는 자리만 골라 감. 스크롤로 종이가 밑으로 들어오면 빈 곳으로 비킴
// 사람이 공을 잡아 끌고 던질 수 있음. 지금 하는 일은 root 의 data-state 로 알려서 CSS 가 애니메이션을 고름
import { pickWanderSpot, ringPoints, stepToward, type Point } from './motion';

/** 공이 올라가도 되는 '책상' 요소. 이것들 위에 다른 것이 없으면 빈 자리로 봄 */
const DESK = 'html, body, main, .blog-main, .blog-page, .blog-board-main, .blog-grid-wrap, .blog-grid, .community-main, [data-desk]';
const EDGE = 14;
const WANDER_SPEED = 46;
const ESCAPE_SPEED = 240;
const NUDGE_SPEED = 150;
const CANDIDATES = 48;
// 던진 공: 1초 뒤에 속도가 이만큼만 남고, 벽에 부딪히면 이만큼만 튕김
const FRICTION_PER_SECOND = 0.14;
const BOUNCE = 0.55;
const MAX_THROW = 1800;
// 이보다 세게 던지면 로키가 공 안에서 같이 굴러 어지러워함
const DIZZY_THROW = 900;
const DIZZY_MS = 1600;
const CURIOUS_RADIUS = 170;

type State = 'hidden' | 'idle' | 'walking' | 'held' | 'rolling' | 'dizzy';

interface EngineHooks {
  /** 놓을 빈 자리가 있는지. 없으면 숨김 */
  onVisible: (visible: boolean) => void;
  /** 세게 던져서 어지러울 때 */
  onDizzy: () => void;
}

export class RockyEngine {
  private state: State = 'hidden';
  private position: Point | null = null;
  private target: Point | null = null;
  private velocity: Point = { x: 0, y: 0 };
  private thrown = 0;
  private speed = WANDER_SPEED;
  private last = 0;
  private frame: number | null = null;
  private timer: number | undefined;
  private actionTimer: number | undefined;
  private checkQueued = false;
  private pointerQueued = false;
  private pointer: Point | null = null;
  private held = false;
  // 공이 굴러간 만큼 돌린 각도(도)
  private rolled = 0;
  private readonly still: boolean;

  constructor(
    private readonly el: HTMLElement,
    private readonly size: number,
    private readonly hooks: EngineHooks,
  ) {
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  start(): void {
    window.addEventListener('scroll', this.queueCheck, { passive: true });
    window.addEventListener('resize', this.queueCheck);
    window.addEventListener('pointermove', this.queuePointer, { passive: true });
    // 페이지가 다 그려진 뒤에 첫 자리를 찾음
    this.timer = window.setTimeout(this.wander, 1200);
  }

  stop(): void {
    window.removeEventListener('scroll', this.queueCheck);
    window.removeEventListener('resize', this.queueCheck);
    window.removeEventListener('pointermove', this.queuePointer);
    window.clearTimeout(this.timer);
    window.clearTimeout(this.actionTimer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
  }

  /** 말풍선을 연 동안은 돌아다니지 않음 */
  hold(held: boolean): void {
    this.held = held;
    window.clearTimeout(this.timer);
    if (!held && this.state === 'idle') this.schedule();
  }

  /** 공을 잡음. 걷거나 구르던 것을 멈춤 */
  grab(): void {
    if (!this.position) return;
    window.clearTimeout(this.timer);
    this.target = null;
    this.velocity = { x: 0, y: 0 };
    this.setState('held');
  }

  /** 잡은 공을 끄는 중. center 는 공 가운데 좌표 */
  dragTo(center: Point): void {
    if (this.state !== 'held' || !this.position) return;
    const next = this.clamp(center);
    this.face(next.x - this.position.x);
    this.roll(next.x - this.position.x, next.y - this.position.y);
    this.position = next;
    this.render();
  }

  /** 놓은 손의 속도(px/s)로 굴려 보냄 */
  release(velocity: Point): void {
    if (this.state !== 'held') return;
    const speed = Math.hypot(velocity.x, velocity.y);
    const scale = speed > MAX_THROW ? MAX_THROW / speed : 1;
    this.velocity = { x: velocity.x * scale, y: velocity.y * scale };
    this.thrown = speed * scale;
    this.setState('rolling');
    this.loop();
  }

  /** 지금 공 가운데. 잡을 때 손과 공 가운데의 거리를 잼 */
  center(): Point | null {
    return this.position && { ...this.position };
  }

  /** 화살표 키로 조금 밈 */
  nudge(dx: number, dy: number): void {
    if (!this.position || this.state === 'held' || this.state === 'rolling' || this.state === 'hidden') return;
    this.moveTo(this.clamp({ x: this.position.x + dx, y: this.position.y + dy }), NUDGE_SPEED);
  }

  /** 말할 때 폴짝, 주먹 맞대기 때 앞다리 들기. 잠깐 data-action 을 붙였다 뗌 */
  act(action: 'hop' | 'bump'): void {
    window.clearTimeout(this.actionTimer);
    this.el.dataset.action = action;
    this.actionTimer = window.setTimeout(() => delete this.el.dataset.action, action === 'bump' ? 1100 : 650);
  }

  private queueCheck = () => {
    if (this.checkQueued) return;
    this.checkQueued = true;
    requestAnimationFrame(() => {
      this.checkQueued = false;
      this.check();
    });
  };

  // 가만히 있을 때 마우스가 가까이 오면 그쪽을 돌아보고 몸을 기울임
  private queuePointer = (event: PointerEvent) => {
    this.pointer = { x: event.clientX, y: event.clientY };
    if (this.pointerQueued) return;
    this.pointerQueued = true;
    requestAnimationFrame(() => {
      this.pointerQueued = false;
      const position = this.position;
      const pointer = this.pointer;
      const near = this.state === 'idle' && position && pointer && Math.hypot(pointer.x - position.x, pointer.y - position.y) < CURIOUS_RADIUS;
      if (near) this.face(pointer.x - position.x);
      this.el.dataset.curious = String(Boolean(near));
    });
  };

  // 지금 자리에 종이가 들어왔으면 가장 가까운 빈 자리로 서둘러 비킴. 빈 자리가 아예 없으면 숨음
  private check(): void {
    if (this.state === 'held' || this.state === 'rolling' || this.state === 'dizzy') return;
    if (this.target && this.speed === ESCAPE_SPEED) return;
    if (this.position && this.state !== 'hidden' && this.isFree(this.position)) return;
    const spots = this.freeSpots();
    if (!spots.length) {
      this.hide();
      return;
    }
    if (!this.position || this.state === 'hidden') {
      this.place(spots[0]!);
      this.schedule();
      return;
    }
    this.moveTo(pickWanderSpot(spots, this.position, 0, Infinity)!, ESCAPE_SPEED);
  }

  private wander = () => {
    if (this.held || this.state === 'held' || this.state === 'rolling' || this.state === 'dizzy') return;
    const next = pickWanderSpot(this.freeSpots(), this.position);
    if (!next) {
      this.hide();
      this.schedule(3000);
      return;
    }
    if (!this.position || this.state === 'hidden' || this.still) {
      this.place(next);
      if (!this.still) this.schedule();
      return;
    }
    this.moveTo(next, WANDER_SPEED);
  };

  private schedule(delay = 2500 + Math.random() * 4500): void {
    window.clearTimeout(this.timer);
    if (this.held) return;
    this.timer = window.setTimeout(this.wander, delay);
  }

  private place(point: Point): void {
    this.position = point;
    this.render();
    this.setState('idle');
    this.hooks.onVisible(true);
  }

  private hide(): void {
    if (this.state === 'hidden') return;
    this.setState('hidden');
    this.hooks.onVisible(false);
  }

  private moveTo(point: Point, speed: number): void {
    if (this.still) {
      this.place(point);
      return;
    }
    window.clearTimeout(this.timer);
    this.target = point;
    this.speed = speed;
    this.face(point.x - this.position!.x);
    this.setState('walking');
    this.loop();
  }

  private loop(): void {
    this.last = performance.now();
    this.frame ??= requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.frame = null;
    if (!this.position) return;
    // 탭을 다녀오면 시간이 크게 벌어지므로 한 프레임에 너무 멀리 가지 않게 자름
    const seconds = Math.min(0.05, Math.max(0, now - this.last) / 1000);
    this.last = now;
    if (this.state === 'walking' && this.target) {
      const { point, arrived } = stepToward(this.position, this.target, seconds * this.speed);
      this.roll(point.x - this.position.x, point.y - this.position.y);
      this.position = point;
      this.render();
      if (arrived) {
        this.target = null;
        this.speed = WANDER_SPEED;
        this.setState('idle');
        this.schedule();
        return;
      }
    } else if (this.state === 'rolling') {
      if (this.rollOn(seconds)) return;
    } else {
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  // 던진 공을 한 프레임 굴림. 멈췄으면 true
  private rollOn(seconds: number): boolean {
    const position = this.position!;
    const keep = FRICTION_PER_SECOND ** seconds;
    this.velocity = { x: this.velocity.x * keep, y: this.velocity.y * keep };
    const free = { x: position.x + this.velocity.x * seconds, y: position.y + this.velocity.y * seconds };
    const next = this.clamp(free);
    // 화면 가장자리에 닿으면 반대로 튕김
    if (next.x !== free.x) this.velocity.x *= -BOUNCE;
    if (next.y !== free.y) this.velocity.y *= -BOUNCE;
    this.face(next.x - position.x);
    this.roll(next.x - position.x, next.y - position.y);
    this.position = next;
    this.render();
    if (Math.hypot(this.velocity.x, this.velocity.y) > 16) return false;
    this.settle();
    return true;
  }

  // 공이 멈춤. 세게 던졌으면 잠깐 어지러워하고, 멈춘 자리가 종이 위면 빈 곳으로 걸어감
  private settle(): void {
    const recover = () => {
      this.setState('idle');
      this.check();
      this.schedule();
    };
    if (this.thrown < DIZZY_THROW) {
      recover();
      return;
    }
    this.setState('dizzy');
    this.hooks.onDizzy();
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(recover, DIZZY_MS);
  }

  // 공 겉의 지오데식 결을 굴러간 거리만큼 돌려서 구르는 것처럼 보이게 함 (호의 길이 = 반지름 x 각도)
  private roll(dx: number, dy: number): void {
    const distance = Math.hypot(dx, dy) * (dx < 0 ? -1 : 1);
    this.rolled = (this.rolled + (distance / (this.size / 2)) * (180 / Math.PI)) % 360;
    this.el.style.setProperty('--rocky-roll', `${this.rolled}deg`);
  }

  // 그림은 오른쪽을 보고 있어서 왼쪽으로 갈 때만 뒤집음. 거의 위아래로만 움직이면 그대로 둠
  private face(dx: number): void {
    if (Math.abs(dx) < 0.5) return;
    this.el.dataset.facing = dx < 0 ? 'left' : 'right';
  }

  private setState(state: State): void {
    this.state = state;
    this.el.dataset.state = state;
  }

  private clamp({ x, y }: Point): Point {
    const radius = this.size / 2;
    return {
      x: Math.min(Math.max(x, radius + EDGE), window.innerWidth - radius - EDGE),
      y: Math.min(Math.max(y, radius + EDGE), window.innerHeight - radius - EDGE),
    };
  }

  private render(): void {
    const { x, y } = this.position!;
    this.el.style.transform = `translate3d(${x - this.size / 2}px, ${y - this.size / 2}px, 0)`;
    // 말풍선이 화면 밖으로 나가지 않게 위아래, 좌우를 고름
    this.el.dataset.below = String(y < 230);
    this.el.dataset.edge = x > window.innerWidth - 160 ? 'right' : x < 160 ? 'left' : 'none';
  }

  // 화면 안에서 공이 들어갈 빈 자리 후보. 무작위로 찍어 보고 빈 곳만 남김
  private freeSpots(): Point[] {
    const radius = this.size / 2;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width < this.size + EDGE * 2 || height < this.size + EDGE * 2) return [];
    const spots: Point[] = [];
    for (let index = 0; index < CANDIDATES; index += 1) {
      const point = {
        x: radius + EDGE + Math.random() * (width - this.size - EDGE * 2),
        y: radius + EDGE + Math.random() * (height - this.size - EDGE * 2),
      };
      if (this.isFree(point)) spots.push(point);
    }
    return spots;
  }

  private isFree(center: Point): boolean {
    return ringPoints(center, this.size / 2 + 8, 8).every(({ x, y }) => {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
      const top = document.elementsFromPoint(x, y).find((element) => !this.el.contains(element));
      return !top || top.matches(DESK);
    });
  }
}
