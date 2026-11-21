import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { HighFiveRepository } from '../domain/high-five.js';
import { HighFiveCounter } from './high-five-counter.schema.js';
import { HighFiveMark } from './high-five-mark.schema.js';

@Injectable()
export class MongoHighFiveRepository extends HighFiveRepository {
  constructor(
    @InjectModel(HighFiveCounter.name) private readonly counters: Model<HighFiveCounter>,
    @InjectModel(HighFiveMark.name) private readonly marks: Model<HighFiveMark>,
  ) {
    super();
  }

  async addToDaily(visitor: string, day: string, count: number) {
    const mark = await this.marks.findOneAndUpdate({ _id: `${visitor}:${day}` }, { $inc: { count } }, { upsert: true, returnDocument: 'after' }).lean();
    return mark?.count ?? count;
  }

  async addToTotal(page: string, count: number) {
    const counter = await this.counters.findOneAndUpdate({ _id: page }, { $inc: { total: count } }, { upsert: true, returnDocument: 'after' }).lean();
    return counter?.total ?? 0;
  }

  async total(page: string) {
    return (await this.counters.findById(page).lean())?.total ?? 0;
  }
}
