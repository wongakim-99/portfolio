import { Injectable } from '@nestjs/common';

// 영역끼리 직접 부르지 않고 '일어난 일'로 알리는 통로. 받는 쪽 처리가 다 끝나야 publish 가 끝남
// 예) 계정(identity)에서 이름이 바뀌면 피드(feed)가 글과 댓글의 글쓴이 이름을 고침
export interface UserRenamed {
  type: 'user.renamed';
  userId: string;
  name: string;
}

export type DomainEvent = UserRenamed;

type Handler<E extends DomainEvent> = (event: E) => Promise<void>;

@Injectable()
export class DomainEvents {
  private readonly handlers = new Map<DomainEvent['type'], Handler<DomainEvent>[]>();

  subscribe<T extends DomainEvent['type']>(type: T, handler: Handler<Extract<DomainEvent, { type: T }>>): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler as Handler<DomainEvent>]);
  }

  async publish(event: DomainEvent): Promise<void> {
    await Promise.all((this.handlers.get(event.type) ?? []).map((handler) => handler(event)));
  }
}
