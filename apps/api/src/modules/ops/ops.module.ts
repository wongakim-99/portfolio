import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityModule } from '../identity/index.js';
import { MetricsRecorder } from './application/metrics-recorder.js';
import { PerformanceService } from './application/performance.service.js';
import { TopologyService } from './application/topology.service.js';
import { MetricsStore } from './domain/metrics.js';
import { DatabaseProbe, HostDetailsSource, ServerStatusSource } from './domain/server-status.js';
import { CgroupHostDetails } from './infrastructure/cgroup-host-details.js';
import { MongoDatabaseProbe } from './infrastructure/mongo-database-probe.js';
import { MongoMetricsStore } from './infrastructure/mongo-metrics.store.js';
import { OpsMinute, OpsMinuteSchema } from './infrastructure/ops-minute.schema.js';
import { SysfsServerStatus } from './infrastructure/sysfs-server-status.js';
import { HealthController, PerformanceController, ServerController, TopologyController } from './presentation/ops.controllers.js';

// 운영 영역: 배포 헬스체크, 홈서버 노트북 상태, 관리실 '지금 흐름' 구성도와 '서버 상태'(1분 집계, 점검표)
@Module({
  imports: [IdentityModule, MongooseModule.forFeature([{ name: OpsMinute.name, schema: OpsMinuteSchema }])],
  controllers: [HealthController, ServerController, TopologyController, PerformanceController],
  providers: [
    TopologyService,
    MetricsRecorder,
    PerformanceService,
    { provide: ServerStatusSource, useClass: SysfsServerStatus },
    { provide: DatabaseProbe, useClass: MongoDatabaseProbe },
    { provide: HostDetailsSource, useClass: CgroupHostDetails },
    { provide: MetricsStore, useClass: MongoMetricsStore },
  ],
})
export class OpsModule {}
