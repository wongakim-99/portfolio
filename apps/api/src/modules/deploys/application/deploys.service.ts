import { Injectable } from '@nestjs/common';
import { DeployRepository, shortCommit, type DeployResult } from '../domain/deploy.js';

@Injectable()
export class DeploysService {
  constructor(private readonly deploys: DeployRepository) {}

  async record(input: { commit: string; subject: string; durationSec: number; result: DeployResult; deployedAt?: string }): Promise<void> {
    await this.deploys.record({
      commit: shortCommit(input.commit), subject: input.subject, durationSec: input.durationSec, result: input.result,
      deployedAt: input.deployedAt ? new Date(input.deployedAt) : new Date(),
    });
  }

  latest(limit: number) {
    return this.deploys.latest(limit);
  }
}
