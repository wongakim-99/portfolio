import type { TelemetryEvent, TelemetryKind, TopologySnapshot } from '@entities/server-status';

// 관리실 '지금 서버' 구성도를 SVG 로 그리고, 받은 요청, DB 명령, 사진 저장소 작업을 일어난 간격 그대로 점으로 흘려보냄
// 점이 초당 수십 번 움직여서 React 상태를 거치지 않고 SVG 요소를 바로 고침. 화면 조립은 server-topology.tsx 가 함
// 페이지 요청은 방문자에서 api 까지 들어갔다가 응답 색으로 돌아오고, DB 와 저장소 작업은 api 에서 오감

const SVG_NS = 'http://www.w3.org/2000/svg';
type NodeKey = 'visitors' | 'funnel' | 'proxy' | 'api' | 'mongo' | 'minio';
type Point = readonly [number, number];

interface Layout {
  view: Point;
  box: Point;
  host: readonly [number, number, number, number];
  hostLabel: 'top' | 'bottom';
  at: Record<NodeKey, Point>;
}

const LAYOUTS: Record<'wide' | 'tall', Layout> = {
  wide: {
    view: [960, 300],
    box: [124, 58],
    host: [330, 22, 612, 256],
    hostLabel: 'top',
    at: { visitors: [70, 150], funnel: [245, 150], proxy: [425, 150], api: [605, 150], mongo: [845, 84], minio: [845, 216] },
  },
  tall: {
    view: [360, 630],
    box: [140, 54],
    host: [14, 214, 332, 404],
    hostLabel: 'bottom',
    at: { visitors: [180, 44], funnel: [180, 140], proxy: [180, 262], api: [180, 380], mongo: [95, 548], minio: [265, 548] },
  },
};
const NODES: readonly [NodeKey, string][] = [
  ['visitors', '방문자'],
  ['funnel', 'Funnel'],
  ['proxy', 'proxy (Caddy)'],
  ['api', 'api (NestJS)'],
  ['mongo', 'mongo'],
  ['minio', 'minio'],
];
const EDGES: readonly [NodeKey, NodeKey, TelemetryKind][] = [
  ['visitors', 'funnel', 'http'],
  ['funnel', 'proxy', 'http'],
  ['proxy', 'api', 'http'],
  ['api', 'mongo', 'db'],
  ['api', 'minio', 'storage'],
];
const ROUTES: Record<TelemetryKind, NodeKey[]> = { http: ['visitors', 'funnel', 'proxy', 'api'], db: ['api', 'mongo'], storage: ['api', 'minio'] };
/** 서버에서 일어난 시각에 이만큼 더한 때에 재생해서, 2초마다 받아도 실제 간격대로 흘러감 */
const LAG_MS = 2200;
const MAX_PACKETS = 80;

interface Packet {
  dot: SVGCircleElement;
  response: string;
  path: NodeKey[];
  turn: number;
  hop: number;
  start: number;
  reached: number;
}

function svgNode<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  parent?.append(element);
  return element;
}

export class TopologyEngine {
  private svg: SVGSVGElement | null = null;
  private packetLayer: SVGGElement | null = null;
  private layout: Layout | null = null;
  private last: TopologySnapshot | null = null;
  private readonly packets = new Set<Packet>();
  private readonly pulses = new Map<NodeKey, ReturnType<typeof setTimeout>>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private frame: number | null = null;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private readonly stage: HTMLElement) {}

  /** 무대 폭이 640px 보다 좁으면 세로 배치로 다시 그림 */
  build() {
    const next = LAYOUTS[this.stage.clientWidth < 640 ? 'tall' : 'wide'];
    if (this.svg && next === this.layout) return;
    this.layout = next;
    for (const packet of this.packets) packet.dot.remove();
    this.packets.clear();

    const svg = svgNode('svg', {
      viewBox: `0 0 ${next.view.join(' ')}`,
      class: 'topology-svg',
      role: 'img',
      'aria-label': '서버 구성도. 방문자가 Tailscale Funnel, Caddy, NestJS 를 거쳐 MongoDB 와 MinIO 로 이어짐',
    });
    const [hx, hy, hw, hh] = next.host;
    svgNode('rect', { x: hx, y: hy, width: hw, height: hh, rx: 14, class: 'topology-host-box' }, svg);
    const labelY = next.hostLabel === 'top' ? hy + 20 : hy + hh - 12;
    svgNode('text', { x: hx + 14, y: labelY, class: 'topology-host-label' }, svg).textContent = 'gawon-dev 노트북 / Docker';
    const edges = svgNode('g', {}, svg);
    this.packetLayer = svgNode('g', {}, svg);
    const boxes = svgNode('g', {}, svg);

    for (const [from, to, kind] of EDGES) {
      const [x1, y1] = next.at[from];
      const [x2, y2] = next.at[to];
      svgNode('line', { x1, y1, x2, y2, class: 'topology-edge' }, edges);
      // 선의 한쪽 옆에 분당 횟수를 적음. 세로선이면 오른쪽, 가로선이면 위
      const length = Math.hypot(x2 - x1, y2 - y1);
      const nx = (y2 - y1) / length;
      const ny = -(x2 - x1) / length;
      svgNode(
        'text',
        {
          x: (x1 + x2) / 2 + nx * 12,
          y: (y1 + y2) / 2 + ny * 12 + 4,
          class: 'topology-rate',
          'data-rate': kind,
          'text-anchor': nx > 0.5 ? 'start' : nx < -0.5 ? 'end' : 'middle',
        },
        edges,
      );
    }

    const [width, height] = next.box;
    for (const [key, title] of NODES) {
      const [cx, cy] = next.at[key];
      const group = svgNode('g', { class: `topology-node${key === 'visitors' ? ' is-outside' : ''}`, 'data-node': key, transform: `translate(${cx} ${cy})` }, boxes);
      const body = svgNode('g', { class: 'topology-node-body' }, group);
      svgNode('rect', { x: -width / 2, y: -height / 2, width, height, rx: 9 }, body);
      svgNode('text', { x: -width / 2 + 12, y: -4, class: 'topology-title' }, body).textContent = title;
      svgNode('text', { x: -width / 2 + 12, y: 15, class: 'topology-stat', 'data-stat': key }, body);
      svgNode('circle', { cx: width / 2 - 12, cy: -height / 2 + 12, r: 4.5, class: 'topology-led', 'data-led': key, 'data-state': 'unknown' }, body);
    }

    this.svg = svg;
    this.stage.replaceChildren(svg);
    if (this.last) this.render(this.last);
  }

  /** 칸마다 상태 글자, 불빛, 선 옆의 분당 횟수 */
  render(data: TopologySnapshot) {
    this.last = data;
    const svg = this.svg;
    if (!svg) return;
    const { nodes, rates } = data;
    const set = (key: NodeKey, text: string, state: string) => {
      const stat = svg.querySelector(`[data-stat="${key}"]`);
      const led = svg.querySelector<SVGElement>(`[data-led="${key}"]`);
      if (stat) stat.textContent = text;
      if (led) led.dataset.state = state;
    };
    const ms = (value: number | null) => (value === null ? '' : `, ${value}ms`);
    set('visitors', `5분 안 ${data.visitors}명`, data.visitors ? 'ok' : 'idle');
    set('funnel', 'Tailscale :443', 'ok');
    set('proxy', nodes.proxy.proxied ? '리버스 프록시' : '로컬 개발', 'ok');
    set('api', `${rates.http}/분${ms(nodes.api.httpMs)}`, 'ok');
    set('mongo', nodes.mongo.up ? `${rates.db}/분${ms(nodes.mongo.ms)}` : '연결 끊김', nodes.mongo.up ? ((nodes.mongo.ms ?? 0) > 200 ? 'warn' : 'ok') : 'down');
    set(
      'minio',
      !nodes.minio ? '설정 안 됨' : nodes.minio.up ? `${rates.storage}/분, ${nodes.minio.ms}ms` : '응답 없음',
      !nodes.minio ? 'idle' : nodes.minio.up ? 'ok' : 'down',
    );
    for (const label of svg.querySelectorAll<SVGTextElement>('[data-rate]')) {
      label.textContent = `${rates[label.dataset.rate as TelemetryKind]}/분`;
    }
  }

  /** 서버에 닿지 않으면 모든 불빛을 빨갛게 */
  markDown() {
    for (const led of this.svg?.querySelectorAll<SVGElement>('[data-led]') ?? []) led.dataset.state = 'down';
  }

  replay(events: TelemetryEvent[], skew: number) {
    events.slice(-MAX_PACKETS).forEach((event, index) => {
      const wait = Math.max(index * 35, event.at + skew + LAG_MS - Date.now());
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.launch(event);
      }, Math.min(wait, 4000));
      this.timers.add(timer);
    });
  }

  destroy() {
    for (const timer of this.timers) clearTimeout(timer);
    for (const timer of this.pulses.values()) clearTimeout(timer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.timers.clear();
    this.pulses.clear();
    this.packets.clear();
    this.stage.replaceChildren();
  }

  private pulse(key: NodeKey) {
    const group = this.svg?.querySelector(`[data-node="${key}"]`);
    if (!group) return;
    group.classList.add('is-hit');
    clearTimeout(this.pulses.get(key));
    this.pulses.set(
      key,
      setTimeout(() => group.classList.remove('is-hit'), 220),
    );
  }

  private launch(event: TelemetryEvent) {
    const route = ROUTES[event.kind];
    if (!this.packetLayer || !route) return;
    if (this.reduced.matches) return this.pulse(route.at(-1)!);
    if (this.packets.size > MAX_PACKETS) return;
    // 첫 프레임 전에도 출발 칸 위에 있도록 처음 자리를 정해 둠
    const [startX, startY] = this.layout?.at[route[0]!] ?? [0, 0];
    const dot = svgNode('circle', { r: event.kind === 'http' ? 5 : 4, cx: startX, cy: startY, class: `topology-packet is-${event.kind}` }, this.packetLayer);
    const response = event.status >= 500 ? 'is-error' : event.status >= 400 ? 'is-warn' : event.kind === 'http' ? 'is-ok' : '';
    this.packets.add({
      dot,
      response,
      path: [...route, ...route.slice(0, -1).reverse()],
      turn: route.length - 1,
      hop: event.kind === 'http' ? 380 : 280,
      start: performance.now(),
      reached: -1,
    });
    this.frame ??= requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    const layout = this.layout;
    for (const packet of this.packets) {
      const progress = (now - packet.start) / packet.hop;
      const index = Math.floor(progress);
      if (!layout || index >= packet.path.length - 1) {
        packet.dot.remove();
        this.packets.delete(packet);
        this.pulse(packet.path.at(-1)!);
        continue;
      }
      if (index !== packet.reached) {
        packet.reached = index;
        this.pulse(packet.path[index]!);
        if (index === packet.turn && packet.response) packet.dot.classList.add(packet.response);
      }
      const [x1, y1] = layout.at[packet.path[index]!];
      const [x2, y2] = layout.at[packet.path[index + 1]!];
      const t = progress - index;
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      packet.dot.setAttribute('cx', String(x1 + (x2 - x1) * eased));
      packet.dot.setAttribute('cy', String(y1 + (y2 - y1) * eased));
    }
    this.frame = this.packets.size ? requestAnimationFrame(this.tick) : null;
  };
}
