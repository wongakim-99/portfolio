import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { DeployRepository, type Deploy } from '../domain/deploy.js';
import { Deploy as DeployDoc } from './deploy.schema.js';

@Injectable()
export class MongoDeployRepository extends DeployRepository {
  constructor(@InjectModel(DeployDoc.name) private readonly deploys: Model<DeployDoc>) {
    super();
  }

  async record({ commit, deployedAt, subject, durationSec, result }: Deploy) {
    await this.deploys.updateOne({ commit, deployedAt }, { $set: { subject, durationSec, result } }, { upsert: true });
  }

  async latest(limit: number) {
    const rows = await this.deploys.find({}, { _id: 0 }).sort({ deployedAt: -1 }).limit(limit).lean();
    return rows.map(({ commit, subject, deployedAt, durationSec, result }) => ({ commit, subject, deployedAt, durationSec, result }));
  }
}
