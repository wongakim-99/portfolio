import { Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import { INBOX_PAGE, MessageRepository } from '../domain/message.js';

@Injectable()
export class MessagesService {
  constructor(private readonly messages: MessageRepository) {}

  async create(input: { name: string; email?: string; message: string }, visitorHash: string, userAgent?: string): Promise<void> {
    await this.messages.create({ name: input.name, email: input.email, message: input.message, visitorHash, userAgent: userAgent?.slice(0, 200) });
  }

  // ADMIN_TOKEN 으로 보는 옛 목록 (GET /api/messages)
  async latest(limit: number) {
    return (await this.messages.latest(limit)).map(({ id, name, email, message, createdAt }) => ({
      _id: id, name, ...(email ? { email } : {}), message, createdAt,
    }));
  }

  // 관리실 쪽지함. 30개씩 최근 것부터
  async inbox(before?: string) {
    const results = await this.messages.latest(INBOX_PAGE + 1, before && requireEntityId(before, '쪽지를 찾을 수 없습니다.'));
    const page = results.slice(0, INBOX_PAGE);
    return {
      messages: page.map((message) => ({
        id: message.id, name: message.name, email: message.email, message: message.message,
        createdAt: message.createdAt, readAt: message.readAt,
      })),
      nextCursor: results.length > INBOX_PAGE ? page.at(-1)!.id : null,
    };
  }

  unreadCount(): Promise<number> {
    return this.messages.unreadCount();
  }

  markAllRead(): Promise<void> {
    return this.messages.markAllRead(new Date());
  }

  async remove(id: string): Promise<void> {
    if (!(await this.messages.delete(requireEntityId(id, '쪽지를 찾을 수 없습니다.')))) throw new NotFoundException('쪽지를 찾을 수 없습니다.');
  }
}
