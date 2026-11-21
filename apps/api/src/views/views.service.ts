import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ViewCounter } from './schemas/view-counter.schema.js';
import { ViewVisitor } from './schemas/view-visitor.schema.js';

const DUPLICATE_KEY = 11000;

@Injectable()
export class ViewsService {
  constructor(
    @InjectModel(ViewCounter.name) private readonly counters: Model<ViewCounter>,
    @InjectModel(ViewVisitor.name) private readonly visitors: Model<ViewVisitor>,
  ) {}

  /** 처음 온 IP 면 1 늘리고, 지금 누적 수를 돌려줌 */
  async hit(page: string, ip: string): Promise<number> {
    const isNewVisit = await this.markVisitor(`${page}:${ip}`);
    if (!isNewVisit) {
      return this.total(page);
    }
    const counter = await this.counters
      .findOneAndUpdate({ _id: page }, { $inc: { total: 1 } }, { upsert: true, returnDocument: 'after' })
      .lean();
    return counter?.total ?? 0;
  }

  async total(page: string): Promise<number> {
    const counter = await this.counters.findById(page).lean();
    return counter?.total ?? 0;
  }

  // 이미 센 IP 면 _id 충돌이 나므로 새 방문이 아님
  private async markVisitor(id: string): Promise<boolean> {
    try {
      await this.visitors.create({ _id: id });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        return false;
      }
      throw error;
    }
  }
}
