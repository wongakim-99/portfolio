import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
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
}
