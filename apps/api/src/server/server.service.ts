import { Injectable } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface ServerStatus {
  uptime: number;
  load: number;
  cores: number;
  memoryUsedPercent: number;
  cpuTemp: number | null;
  battery: { percent: number; charging: boolean; pluggedIn: boolean | null } | null;
  release: { commit: string; deployedAt: string | null } | null;
}

const CACHE_MS = 5_000;
// 노트북 CPU 온도는 x86_pkg_temp 가 가장 정확하고, 없으면 메인보드 센서(acpitz)를 씀
const THERMAL_TYPES = ['x86_pkg_temp', 'acpitz'];

// 페이지 하단 영수증에 보여 줄 홈서버 상태. 없는 센서는 null 로 둠
@Injectable()
export class ServerService {
  // 테스트에서 가짜 /sys 를 쓰려고 경로를 바꿀 수 있게 둠
  private readonly sysRoot = process.env.SYSFS_ROOT ?? '/sys';
  private readonly release = readRelease(process.env);
  private cache?: { at: number; value: Promise<ServerStatus> };

  status(): Promise<ServerStatus> {
    const now = Date.now();
    if (!this.cache || now - this.cache.at > CACHE_MS) {
      this.cache = { at: now, value: this.collect() };
    }
    return this.cache.value;
  }

  private async collect(): Promise<ServerStatus> {
    const [cpuTemp, battery] = await Promise.all([this.cpuTemp(), this.battery()]);
    const total = os.totalmem();
    return {
      uptime: Math.round(os.uptime()),
      load: Math.round(os.loadavg()[0] * 100) / 100,
      cores: os.cpus().length,
      memoryUsedPercent: Math.round(((total - os.freemem()) / total) * 100),
      cpuTemp,
      battery,
      release: this.release,
    };
  }

  private async cpuTemp(): Promise<number | null> {
    const base = path.join(this.sysRoot, 'class/thermal');
    const zones = (await list(base)).filter((name) => name.startsWith('thermal_zone'));
    const found = new Map<string, number>();
    for (const zone of zones) {
      const type = await read(path.join(base, zone, 'type'));
      const milli = Number(await read(path.join(base, zone, 'temp')));
      if (type && Number.isFinite(milli) && milli > 0 && milli < 150_000) {
        found.set(type, Math.round(milli / 1000));
      }
    }
    for (const type of THERMAL_TYPES) {
      if (found.has(type)) return found.get(type)!;
    }
    return null;
  }

  private async battery(): Promise<ServerStatus['battery']> {
    const base = path.join(this.sysRoot, 'class/power_supply');
    let battery: { percent: number; charging: boolean } | null = null;
    let pluggedIn: boolean | null = null;
    for (const name of await list(base)) {
      const type = await read(path.join(base, name, 'type'));
      if (type === 'Battery' && !battery) {
        const percent = Number(await read(path.join(base, name, 'capacity')));
        const status = await read(path.join(base, name, 'status'));
        if (Number.isFinite(percent)) battery = { percent, charging: status === 'Charging' };
      }
      if (type === 'Mains') {
        pluggedIn = pluggedIn === true || (await read(path.join(base, name, 'online'))) === '1';
      }
    }
    return battery && { ...battery, pluggedIn };
  }
}

// 이미지를 만들 때 deploy.sh 가 커밋과 빌드 시각을 환경변수로 넣어 둠 (apps/api/Dockerfile)
export function readRelease(env: NodeJS.ProcessEnv): ServerStatus['release'] {
  const commit = env.RELEASE_COMMIT?.trim();
  if (!commit) return null;
  const builtAt = new Date(env.RELEASE_BUILT_AT ?? '');
  return {
    commit: commit.slice(0, 7),
    deployedAt: Number.isNaN(builtAt.getTime()) ? null : builtAt.toISOString(),
  };
}

async function list(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function read(file: string): Promise<string | null> {
  try {
    return (await readFile(file, 'utf8')).trim();
  } catch {
    return null;
  }
}
