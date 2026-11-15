import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { CreateMessageDto } from './dto/create-message.dto.js';
import { Message } from './schemas/message.schema.js';

@Injectable()
export class MessagesService {
  constructor(@InjectModel(Message.name) private readonly messages: Model<Message>) {}

  async create(dto: CreateMessageDto, visitorHash: string, userAgent?: string): Promise<void> {
    await this.messages.create({
      name: dto.name,
      email: dto.email,
      message: dto.message,
      visitorHash,
      userAgent: userAgent?.slice(0, 200),
    });
  }

  latest(limit: number) {
    return this.messages
      .find({}, { name: 1, email: 1, message: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  // 관리실 쪽지함. 30개씩 최근 것부터
  async inbox(before?: string) {
    const filter = before ? { _id: { $lt: messageId(before) } } : {};
    const results = await this.messages.find(filter, { name: 1, email: 1, message: 1, createdAt: 1, readAt: 1 })
      .sort({ _id: -1 }).limit(31).lean();
    const page = results.slice(0, 30);
    return {
      messages: page.map((message) => ({
        id: String(message._id), name: message.name, email: message.email ?? null, message: message.message,
        createdAt: message.createdAt, readAt: message.readAt ?? null,
      })),
      nextCursor: results.length > 30 ? String(page.at(-1)!._id) : null,
    };
  }

  unreadCount(): Promise<number> {
    return this.messages.countDocuments({ readAt: null });
  }

  async markAllRead(): Promise<void> {
    await this.messages.updateMany({ readAt: null }, { $set: { readAt: new Date() } });
  }

  async remove(id: string): Promise<void> {
    const result = await this.messages.deleteOne({ _id: messageId(id) });
    if (!result.deletedCount) throw new NotFoundException('쪽지를 찾을 수 없습니다.');
  }
}

function messageId(value: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new NotFoundException('쪽지를 찾을 수 없습니다.');
  return new Types.ObjectId(value);
}
