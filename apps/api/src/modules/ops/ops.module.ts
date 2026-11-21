import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/index.js';
import { TopologyService } from './application/topology.service.js';
import { DatabaseProbe, ServerStatusSource } from './domain/server-status.js';
import { MongoDatabaseProbe } from './infrastructure/mongo-database-probe.js';
import { SysfsServerStatus } from './infrastructure/sysfs-server-status.js';
import { HealthController, ServerController, TopologyController } from './presentation/ops.controllers.js';

// 운영 영역: 배포 헬스체크, 홈서버 노트북 상태, 관리실 '지금 서버' 구성도
@Module({
  imports: [IdentityModule],
  controllers: [HealthController, ServerController, TopologyController],
  providers: [
    TopologyService,
    { provide: ServerStatusSource, useClass: SysfsServerStatus },
    { provide: DatabaseProbe, useClass: MongoDatabaseProbe },
  ],
})
export class OpsModule {}
