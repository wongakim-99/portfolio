import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { toObjectId } from '../../../shared/infrastructure/mongo.js';
import { MessageRepository } from '../domain/message.js';
import { Message } from './message.schema.js';

@Injectable()
export class MongoMessageRepository extends MessageRepository {
  constructor(@InjectModel(Message.name) private readonly messages: Model<Message>) {
    super();
  }

  async create(input: { name: string; email?: string; message: string; visitorHash: string; userAgent?: string }) {
    await this.messages.create(input);
  }

  async latest(limit: number, before?: string) {
    const filter = before ? { _id: { $lt: toObjectId(before) } } : {};
    const rows = await this.messages.find(filter).sort({ _id: -1 }).limit(limit).lean();
    return rows.map((row) => ({
      id: String(row._id), name: row.name, email: row.email ?? null, message: row.message, createdAt: row.createdAt, readAt: row.readAt ?? null,
    }));
  }

  unreadCount() {
    return this.messages.countDocuments({ readAt: null });
  }

  async markAllRead(at: Date) {
    await this.messages.updateMany({ readAt: null }, { $set: { readAt: at } });
  }

  async delete(id: string) {
    return (await this.messages.deleteOne({ _id: toObjectId(id) })).deletedCount > 0;
  }
}
