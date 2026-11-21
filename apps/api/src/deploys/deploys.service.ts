import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { RecordDeployDto } from './dto/record-deploy.dto.js';
import { Deploy } from './schemas/deploy.schema.js';

@Injectable()
export class DeploysService {
  constructor(@InjectModel(Deploy.name) private readonly deploys: Model<Deploy>) {}

  async record(dto: RecordDeployDto): Promise<void> {
    const commit = dto.commit.slice(0, 7);
    const deployedAt = dto.deployedAt ? new Date(dto.deployedAt) : new Date();
    await this.deploys.updateOne(
      { commit, deployedAt },
      { $set: { subject: dto.subject, durationSec: dto.durationSec, result: dto.result } },
      { upsert: true },
    );
  }

  /** 최근 배포부터 */
  async latest(limit: number) {
    const rows = await this.deploys.find({}, { _id: 0 }).sort({ deployedAt: -1 }).limit(limit).lean();
    return rows.map(({ commit, subject, deployedAt, durationSec, result }) => ({ commit, subject, deployedAt, durationSec, result }));
  }
}
