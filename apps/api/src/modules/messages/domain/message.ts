// 홈의 엽서와 숨은 터미널 mail gawon 으로 받는 쪽지. 관리실 쪽지함에서 읽음

export interface Message {
  id: string;
  name: string;
  email: string | null;
  message: string;
  createdAt: Date;
  /** 관리실에서 처음 본 시각. 없으면 안 읽은 것 */
  readAt: Date | null;
}

export const INBOX_PAGE = 30;

export abstract class MessageRepository {
  abstract create(input: { name: string; email?: string; message: string; visitorHash: string; userAgent?: string }): Promise<void>;
  /** 최근 것부터. before 는 이 쪽지보다 오래된 것만 */
  abstract latest(limit: number, before?: string): Promise<Message[]>;
  abstract unreadCount(): Promise<number>;
  abstract markAllRead(at: Date): Promise<void>;
  abstract delete(id: string): Promise<boolean>;
}
