import { Injectable } from '@nestjs/common';
import { VisitRepository } from '../domain/visit.js';

@Injectable()
export class VisitsService {
  constructor(private readonly visits: VisitRepository) {}

  /** 처음 온 IP 면 1 늘리고, 지금 누적 수를 돌려줌 */
  async hit(page: string, ipHash: string): Promise<number> {
    return (await this.visits.markVisitor(page, ipHash)) ? this.visits.increment(page) : this.visits.total(page);
  }

  total(page: string): Promise<number> {
    return this.visits.total(page);
  }
}
