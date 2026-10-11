import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { HighFiveCounter } from './schemas/high-five-counter.schema.js';
import { HighFiveMark } from './schemas/high-five-mark.schema.js';

const PAGE = 'home';
// 한 사람이 하루에 올릴 수 있는 최대치. 넘친 만큼은 세지 않음
export const DAILY_LIMIT = 50;

@Injectable()
export class HighFivesService {
  constructor(
    @InjectModel(HighFiveCounter.name) private readonly counters: Model<HighFiveCounter>,
    @InjectModel(HighFiveMark.name) private readonly marks: Model<HighFiveMark>,
  ) {}

  async give(visitor: string, count: number): Promise<{ total: number; accepted: number }> {
    const day = new Date().toISOString().slice(0, 10);
    const mark = await this.marks
      .findOneAndUpdate({ _id: `${visitor}:${day}` }, { $inc: { count } }, { upsert: true, returnDocument: 'after' })
      .lean();
    const over = Math.max(0, (mark?.count ?? count) - DAILY_LIMIT);
    const accepted = Math.max(0, count - over);
    if (accepted === 0) {
      return { total: await this.total(), accepted };
    }
    const counter = await this.counters
      .findOneAndUpdate({ _id: PAGE }, { $inc: { total: accepted } }, { upsert: true, returnDocument: 'after' })
      .lean();
    return { total: counter?.total ?? 0, accepted };
  }

  async total(): Promise<number> {
    const counter = await this.counters.findById(PAGE).lean();
    return counter?.total ?? 0;
  }
}
