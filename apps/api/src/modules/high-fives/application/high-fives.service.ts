import { Injectable } from '@nestjs/common';
import { acceptedHighFives, HIGH_FIVE_PAGE, HighFiveRepository } from '../domain/high-five.js';

@Injectable()
export class HighFivesService {
  constructor(private readonly highFives: HighFiveRepository) {}

  async give(visitor: string, count: number): Promise<{ total: number; accepted: number }> {
    const day = new Date().toISOString().slice(0, 10);
    const sentToday = await this.highFives.addToDaily(visitor, day, count);
    const accepted = acceptedHighFives(sentToday, count);
    if (accepted === 0) return { total: await this.total(), accepted };
    return { total: await this.highFives.addToTotal(HIGH_FIVE_PAGE, accepted), accepted };
  }

  total(): Promise<number> {
    return this.highFives.total(HIGH_FIVE_PAGE);
  }
}
