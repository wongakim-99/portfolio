import { Injectable } from '@nestjs/common';
import { readFile, statfs } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HostDetailsSource, type HostDetails } from '../domain/server-status.js';

// 새 권한 없이 api 컨테이너 안에서 보이는 것만 읽음. cgroup v2 파일과 루트 디스크
// 테스트와 로컬(macOS)처럼 cgroup 이 없으면 container 는 null
const CGROUP = process.env.CGROUP_ROOT ?? '/sys/fs/cgroup';

const field = (text: string, name: string) => {
  const match = new RegExp(`^${name} (\\d+)$`, 'm').exec(text);
  return match ? Number(match[1]) : null;
};

@Injectable()
export class CgroupHostDetails extends HostDetailsSource {
  async details(): Promise<HostDetails> {
    const [disk, container] = await Promise.all([this.disk(), this.container()]);
    return { loadAverage: os.loadavg().map((value) => Math.round(value * 100) / 100), totalMemory: os.totalmem(), disk, container };
  }

  private async disk(): Promise<HostDetails['disk']> {
    try {
      const stats = await statfs('/');
      return { total: stats.blocks * stats.bsize, free: stats.bavail * stats.bsize };
    } catch {
      return null;
    }
  }

  // docker stats 와 같이 페이지 캐시(inactive_file)는 뺌
  private async container(): Promise<HostDetails['container']> {
    try {
      const [max, current, stat] = await Promise.all([
        readFile(path.join(CGROUP, 'memory.max'), 'utf8'),
        readFile(path.join(CGROUP, 'memory.current'), 'utf8'),
        readFile(path.join(CGROUP, 'memory.stat'), 'utf8').catch(() => ''),
      ]);
      const used = Number(current.trim());
      if (!Number.isFinite(used)) return null;
      const limit = max.trim();
      return { used: Math.max(0, used - (field(stat, 'inactive_file') ?? 0)), limit: limit === 'max' ? null : Number(limit) };
    } catch {
      return null;
    }
  }
}
