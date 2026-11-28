import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { GuardStore, type GuardBan, type GuardEvent, type GuardKind } from '../domain/guard.js';
import { GuardBan as GuardBanDoc, GuardEvent as GuardEventDoc } from './guard.schemas.js';

type BanRow = GuardBanDoc & { _id: Types.ObjectId };
const toBan = ({ _id, ipHash, ip, kind, reason, since, until, blocked }: BanRow): GuardBan => ({ id: String(_id), ipHash, ip, kind, reason, since, until, blocked });

@Injectable()
export class MongoGuardStore extends GuardStore {
  constructor(
    @InjectModel(GuardEventDoc.name) private readonly eventModel: Model<GuardEventDoc>,
    @InjectModel(GuardBanDoc.name) private readonly banModel: Model<GuardBanDoc>,
  ) {
    super();
  }

  async record(event: GuardEvent): Promise<void> {
    await this.eventModel.create(event);
  }

  async events(since: Date, limit: number): Promise<GuardEvent[]> {
    const rows = await this.eventModel.find({ at: { $gte: since } }, { _id: 0 }).sort({ at: -1 }).limit(limit).lean();
    return rows.map(({ at, kind, ipHash, ip, method, path, agent }) => ({ at, kind, ipHash, ip, method, path, agent }));
  }

  async counts(since: Date) {
    return this.eventModel.aggregate<{ kind: GuardKind; count: number }>([
      { $match: { at: { $gte: since } } },
      { $group: { _id: '$kind', count: { $sum: 1 } } },
      { $project: { _id: 0, kind: '$_id', count: 1 } },
    ]);
  }

  async topIps(since: Date, limit: number) {
    return this.eventModel.aggregate<{ ip: string; count: number; kinds: GuardKind[] }>([
      { $match: { at: { $gte: since } } },
      { $group: { _id: '$ipHash', ip: { $first: '$ip' }, count: { $sum: 1 }, kinds: { $addToSet: '$kind' } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, ip: 1, count: 1, kinds: 1 } },
    ]);
  }

  async ban(ban: Omit<GuardBan, 'id' | 'blocked'>): Promise<GuardBan> {
    const doc = await this.banModel.create({ ...ban, blocked: 0 });
    return toBan(doc.toObject() as BanRow);
  }

  async activeBans(now: Date): Promise<GuardBan[]> {
    const rows = await this.banModel.find({ until: { $gt: now } }).sort({ since: -1 }).lean<BanRow[]>();
    return rows.map(toBan);
  }

  async lift(id: string, now: Date): Promise<GuardBan | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const row = await this.banModel.findOneAndUpdate({ _id: id, until: { $gt: now } }, { $set: { until: now } }, { new: false }).lean<BanRow>();
    return row ? toBan(row) : null;
  }

  async addBlocked(counts: ReadonlyMap<string, number>): Promise<void> {
    if (!counts.size) return;
    await this.banModel.bulkWrite([...counts].map(([id, count]) => ({ updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $inc: { blocked: count } } } })));
  }
}
