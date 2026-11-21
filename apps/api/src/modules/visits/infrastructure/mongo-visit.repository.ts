import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { isDuplicateKey } from '../../../shared/infrastructure/mongo.js';
import { VisitRepository } from '../domain/visit.js';
import { ViewCounter } from './view-counter.schema.js';
import { ViewVisitor } from './view-visitor.schema.js';

@Injectable()
export class MongoVisitRepository extends VisitRepository {
  constructor(
    @InjectModel(ViewCounter.name) private readonly counters: Model<ViewCounter>,
    @InjectModel(ViewVisitor.name) private readonly visitors: Model<ViewVisitor>,
  ) {
    super();
  }

  // 이미 센 IP 면 _id 충돌이 나므로 새 방문이 아님
  async markVisitor(page: string, ipHash: string) {
    try {
      await this.visitors.create({ _id: `${page}:${ipHash}` });
      return true;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async increment(page: string) {
    const counter = await this.counters.findOneAndUpdate({ _id: page }, { $inc: { total: 1 } }, { upsert: true, returnDocument: 'after' }).lean();
    return counter?.total ?? 0;
  }

  async total(page: string) {
    return (await this.counters.findById(page).lean())?.total ?? 0;
  }
}
