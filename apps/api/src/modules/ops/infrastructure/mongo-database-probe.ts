import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { DatabaseProbe } from '../domain/server-status.js';

@Injectable()
export class MongoDatabaseProbe extends DatabaseProbe {
  constructor(@InjectConnection() private readonly connection: Connection) {
    super();
  }

  get connected(): boolean {
    return this.connection.readyState === 1;
  }

  async ping(): Promise<'up' | 'down'> {
    try {
      await this.connection.db?.admin().ping();
      return this.connection.db ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
