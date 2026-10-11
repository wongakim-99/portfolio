import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ViewCounter } from './schemas/view-counter.schema.js';
import { ViewMark } from './schemas/view-mark.schema.js';

const DUPLICATE_KEY = 11000;

@Injectable()
export class ViewsService {
  constructor(
    @InjectModel(ViewCounter.name) private readonly counters: Model<ViewCounter>,
    @InjectModel(ViewMark.name) private readonly marks: Model<ViewMark>,
  ) {}

  async hit(page: string, visitor: string): Promise<number> {
    const isNewVisit = await this.markVisit(`${page}:${visitor}`);
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

  // 30분 안에 같은 표식이 있으면 unique 충돌이 나므로 새 방문이 아님
  private async markVisit(id: string): Promise<boolean> {
    try {
      await this.marks.create({ _id: id });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        return false;
      }
      throw error;
    }
  }
}
