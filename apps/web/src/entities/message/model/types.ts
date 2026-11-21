/** 홈 엽서로 받은 쪽지 */
export interface InboxMessage {
  id: string;
  name: string;
  email: string | null;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface InboxPage {
  messages: InboxMessage[];
  nextCursor: string | null;
  unread: number;
}
