import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.js';
import { hashIp } from '../../../shared/http/visitor-hash.js';
import {
  BAN_RULES, banReason, GUARD_KINDS, GuardStore, isExempt, KEEP_EVENT_DAYS, maskIp, WINDOW_MS, WRITES_PER_MINUTE, type GuardBan, type GuardKind,
} from '../domain/guard.js';

const FLUSH_MS = 30_000;
const DAY_MS = 24 * 60 * 60_000;

export interface Suspicious {
  kind: GuardKind;
  ip: string;
  method: string;
  path: string;
  agent: string;
}

/**
 * IP 별로 수상한 요청을 세고, BAN_RULES 를 넘으면 막음
 * 막힌 IP 는 메모리에 두고 요청마다 바로 확인함 (재시작하면 DB 에서 다시 읽음). 센 기록은 10분 창만 메모리에 둠
 */
@Injectable()
export class GuardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GuardService.name);
  private readonly salt: string;
  private readonly bans = new Map<string, GuardBan>();
  private readonly recent = new Map<string, number[]>();
  private readonly writes = new Map<string, { minute: number; count: number }>();
  private readonly blocked = new Map<string, number>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly store: GuardStore,
    config: ConfigService<Env, true>,
  ) {
    this.salt = config.get('HASH_SALT', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    try {
      for (const ban of await this.store.activeBans(new Date())) this.bans.set(ban.ipHash, ban);
    } catch (error) {
      this.logger.warn(`막은 주소를 읽지 못함: ${String(error)}`);
    }
    this.timer = setInterval(() => void this.flush(), FLUSH_MS);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  /** 막혀 있으면 그 기록. 돌려보낸 수도 셈 */
  banned(ip: string): GuardBan | null {
    if (!this.bans.size || isExempt(ip)) return null;
    const ipHash = hashIp(ip, this.salt);
    const ban = this.bans.get(ipHash);
    if (!ban) return null;
    if (ban.until.getTime() <= Date.now()) {
      this.bans.delete(ipHash);
      return null;
    }
    this.blocked.set(ban.id, (this.blocked.get(ban.id) ?? 0) + 1);
    return ban;
  }

  /** 수상한 요청 하나. 기록하고, 10분 창 안에서 기준을 넘으면 막음 */
  async note({ kind, ip, method, path, agent }: Suspicious): Promise<void> {
    if (isExempt(ip)) return;
    const now = Date.now();
    const ipHash = hashIp(ip, this.salt);
    const masked = maskIp(ip);
    const key = `${ipHash}:${kind}`;
    const times = (this.recent.get(key) ?? []).filter((time) => time > now - WINDOW_MS);
    times.push(now);
    this.recent.set(key, times);

    const minute = Math.floor(now / 60_000);
    const written = this.writes.get(ipHash);
    const count = written?.minute === minute ? written.count + 1 : 1;
    this.writes.set(ipHash, { minute, count });
    try {
      if (count <= WRITES_PER_MINUTE) {
        await this.store.record({ at: new Date(now), kind, ipHash, ip: masked, method, path: path.slice(0, 200), agent: agent.slice(0, 200) });
      }
      const rule = BAN_RULES[kind];
      if (times.length >= rule.count && !this.bans.has(ipHash)) {
        // 기록을 기다리는 사이 같은 IP 가 또 들어와도 한 번만 막게 먼저 자리를 잡음
        const pending: GuardBan = { id: '', ipHash, ip: masked, kind, reason: banReason(kind), since: new Date(now), until: new Date(now + rule.hours * 3_600_000), blocked: 0 };
        this.bans.set(ipHash, pending);
        const saved = await this.store.ban({ ipHash, ip: masked, kind, reason: pending.reason, since: pending.since, until: pending.until });
        this.bans.set(ipHash, saved);
        this.logger.log(`${masked} 막음: ${saved.reason}`);
      }
    } catch (error) {
      this.logger.warn(`이상 징후 기록 실패: ${String(error)}`);
    }
  }

  /** 관리실 '이상 징후' 칸. 최근 24시간 */
  async overview(now = Date.now()) {
    const since = new Date(now - DAY_MS);
    const [events, counts, topIps, bans] = await Promise.all([
      this.store.events(since, 60),
      this.store.counts(since),
      this.store.topIps(since, 8),
      this.store.activeBans(new Date(now)),
    ]);
    const count = (kind: GuardKind) => counts.find((row) => row.kind === kind)?.count ?? 0;
    return {
      keepDays: KEEP_EVENT_DAYS,
      counts: Object.fromEntries(GUARD_KINDS.map((kind) => [kind, count(kind)])) as Record<GuardKind, number>,
      rules: GUARD_KINDS.map((kind) => ({ kind, ...BAN_RULES[kind] })),
      // 아직 DB 에 반영 안 된 돌려보낸 수를 더해 보여 줌
      bans: bans.map((ban) => ({ ...ban, ipHash: undefined, blocked: ban.blocked + (this.blocked.get(ban.id) ?? 0) })),
      topIps,
      events: events.map(({ ipHash: _hash, ...event }) => event),
    };
  }

  async lift(id: string): Promise<boolean> {
    const ban = await this.store.lift(id, new Date());
    if (!ban) return false;
    this.bans.delete(ban.ipHash);
    // 풀자마자 지난 기록 때문에 다시 막히지 않게 창도 비움
    for (const kind of GUARD_KINDS) this.recent.delete(`${ban.ipHash}:${kind}`);
    return true;
  }

  private async flush(): Promise<void> {
    const now = Date.now();
    for (const [key, times] of this.recent) if (!times.some((time) => time > now - WINDOW_MS)) this.recent.delete(key);
    const minute = Math.floor(now / 60_000);
    for (const [key, written] of this.writes) if (written.minute < minute) this.writes.delete(key);
    for (const [key, ban] of this.bans) if (ban.until.getTime() <= now) this.bans.delete(key);
    if (!this.blocked.size) return;
    const counts = new Map([...this.blocked].filter(([id]) => id));
    this.blocked.clear();
    try {
      await this.store.addBlocked(counts);
    } catch {
      // 돌려보낸 수는 곁들이는 숫자라 못 남겨도 그냥 둠
    }
  }
}
