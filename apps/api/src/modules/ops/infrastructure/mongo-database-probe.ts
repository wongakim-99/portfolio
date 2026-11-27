import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { performance } from 'node:perf_hooks';
import { DatabaseProbe, type CollectionSize, type DatabaseFacts } from '../domain/server-status.js';

const QUERY = { maxTimeMS: 5_000 } as const;

@Injectable()
export class MongoDatabaseProbe extends DatabaseProbe {
  constructor(@InjectConnection() private readonly connection: Connection) {
    super();
  }

  get connected(): boolean {
    return this.connection.readyState === 1;
  }

  async ping(): Promise<'up' | 'down'> {
    try {
      await this.connection.db?.admin().ping();
      return this.connection.db ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  async latency(): Promise<number | null> {
    const db = this.connection.db;
    if (!db) return null;
    const started = performance.now();
    try {
      await db.command({ ping: 1 }, { timeoutMS: 2_000 });
      return Number((performance.now() - started).toFixed(1));
    } catch {
      return null;
    }
  }

  // 앱 계정(readWrite)으로 되는 명령만 씀. serverStatus 같은 것은 clusterMonitor 권한이 있어야 해서 쓰지 않음
  async describe(): Promise<DatabaseFacts> {
    const db = this.connection.db;
    if (!db) return { version: null, totals: null, collections: null };
    const [version, totals, collections] = await Promise.all([
      db.admin().command({ buildInfo: 1 }).then((info) => String(info.version), () => null),
      db.stats(QUERY).then(
        (stats) => ({ objects: Number(stats.objects), size: Number(stats.dataSize), storage: Number(stats.storageSize), indexes: Number(stats.indexSize) }),
        () => null,
      ),
      this.collections().catch(() => null),
    ]);
    return { version, totals, collections };
  }

  private async collections(): Promise<CollectionSize[]> {
    const db = this.connection.db!;
    const names = (await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray())
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'));
    const sizes = await Promise.all(
      names.map(async (name) => {
        const [stats] = await db.collection(name).aggregate<{ storageStats?: Record<string, number> }>([{ $collStats: { storageStats: {} } }], QUERY).toArray();
        const storage = stats?.storageStats ?? {};
        return { name, count: Number(storage.count ?? 0), size: Number(storage.size ?? 0), storage: Number(storage.storageSize ?? 0), indexes: Number(storage.totalIndexSize ?? 0) };
      }),
    );
    return sizes.sort((a, b) => b.storage + b.indexes - (a.storage + a.indexes));
  }
}
