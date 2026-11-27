import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { MetricsStore, type OpsMinute } from '../domain/metrics.js';
import { OpsMinute as OpsMinuteDoc } from './ops-minute.schema.js';

@Injectable()
export class MongoMetricsStore extends MetricsStore {
  constructor(@InjectModel(OpsMinuteDoc.name) private readonly minutes: Model<OpsMinuteDoc>) {
    super();
  }

  async save(row: OpsMinute): Promise<void> {
    await this.minutes.create(row);
  }

  async since(from: Date): Promise<OpsMinute[]> {
    const rows = await this.minutes.find({ minute: { $gte: from } }, { _id: 0 }).sort({ minute: 1 }).lean().maxTimeMS(5_000);
    return rows.map(({ minute, traffic, process, host, db, storage }) => ({ minute, traffic, process, host, db, storage }));
  }
}
