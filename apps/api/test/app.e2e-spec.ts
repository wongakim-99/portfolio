import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { readRelease } from '../src/server/server.service.js';
import { configureApp } from '../src/setup.js';

const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef';
let mongo: MongoMemoryServer;

// ConfigModule.forRoot 가 import 시점에 env 를 읽으므로 env 를 먼저 채우고 동적 import 함
async function createApp(): Promise<INestApplication<App>> {
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app as INestApplication<App>;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('portfolio_test');
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  process.env.HASH_SALT = 'test-salt';
});

afterAll(async () => {
  await mongo?.stop();
});

describe('health', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('DB 가 붙어 있으면 ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });
});

describe('views', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('같은 방문자의 새로고침은 한 번만 셈', async () => {
    const server = app.getHttpServer();
    const first = await request(server).post('/api/views').set('User-Agent', 'visitor-a').expect(200);
    const again = await request(server).post('/api/views').set('User-Agent', 'visitor-a').expect(200);
    expect(again.body.total).toBe(first.body.total);
  });

  it('다른 방문자는 1 증가', async () => {
    const server = app.getHttpServer();
    const before = await request(server).get('/api/views').expect(200);
    const after = await request(server).post('/api/views').set('User-Agent', 'visitor-b').expect(200);
    expect(after.body.total).toBe(before.body.total + 1);
  });
});

describe('messages', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('저장 후 관리자 토큰으로만 조회됨', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/messages')
      .send({ name: '  방문자  ', email: '', message: '포트폴리오 잘 봤습니다' })
      .expect(201);

    await request(server).get('/api/messages').expect(401);
    await request(server).get('/api/messages').set('Authorization', 'Bearer wrong-token').expect(401);

    const res = await request(server)
      .get('/api/messages')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    expect(res.body.messages[0]).toMatchObject({ name: '방문자', message: '포트폴리오 잘 봤습니다' });
    expect(res.body.messages[0]).not.toHaveProperty('email');
    expect(res.body.messages[0]).not.toHaveProperty('visitorHash');
  });

  it('honeypot 이 채워지면 성공처럼 응답하고 저장하지 않음', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/messages')
      .send({ name: 'bot', message: 'buy cheap things now', website: 'http://spam.example' })
      .expect(201);
    const res = await request(server)
      .get('/api/messages')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    expect(res.body.messages.map((m: { name: string }) => m.name)).not.toContain('bot');
  });
});

describe('messages 검증과 제한', () => {
  let app: INestApplication<App>;
  beforeEach(async () => (app = await createApp()));
  afterEach(async () => app.close());

  it('짧은 본문, 잘못된 메일, 모르는 필드는 400', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/messages').send({ name: 'a', message: 'hi' }).expect(400);
    await request(server)
      .post('/api/messages')
      .send({ name: 'a', email: 'not-mail', message: 'hello there' })
      .expect(400);
  });

  it('모르는 필드는 400', async () => {
    await request(app.getHttpServer())
      .post('/api/messages')
      .send({ name: 'a', message: 'hello there', admin: true })
      .expect(400);
  });

  it('같은 IP 에서 10분에 3건을 넘기면 429', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 3; i++) {
      await request(server).post('/api/messages').send({ name: 'a', message: `hello ${i} there` }).expect(201);
    }
    await request(server).post('/api/messages').send({ name: 'a', message: 'one more time' }).expect(429);
  });
});

// 가짜 /sys 를 만들어 홈서버 노트북의 센서 파일 구조를 흉내 냄
async function fakeSysfs(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sysfs-'));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), `${content}\n`);
  }
  return root;
}

describe('server', () => {
  let app: INestApplication<App>;
  let sysfs: string;

  afterEach(async () => {
    await app?.close();
    delete process.env.SYSFS_ROOT;
    await rm(sysfs, { recursive: true, force: true });
  });

  it('노트북 센서 값을 읽어 옴', async () => {
    sysfs = await fakeSysfs({
      'class/thermal/thermal_zone0/type': 'acpitz',
      'class/thermal/thermal_zone0/temp': '44000',
      'class/thermal/thermal_zone11/type': 'x86_pkg_temp',
      'class/thermal/thermal_zone11/temp': '37000',
      'class/power_supply/ACAD/type': 'Mains',
      'class/power_supply/ACAD/online': '1',
      'class/power_supply/BAT1/type': 'Battery',
      'class/power_supply/BAT1/capacity': '91',
      'class/power_supply/BAT1/status': 'Not charging',
      'class/power_supply/ucsi-source-psy-USBC000:001/type': 'USB',
    });
    process.env.SYSFS_ROOT = sysfs;
    app = await createApp();

    const res = await request(app.getHttpServer()).get('/api/server').expect(200);
    expect(res.body).toMatchObject({
      cpuTemp: 37,
      battery: { percent: 91, charging: false, pluggedIn: true },
      release: null,
    });
    expect(res.body.uptime).toBeGreaterThan(0);
    expect(res.body.memoryUsedPercent).toBeGreaterThanOrEqual(0);
  });

  it('센서가 없으면 null', async () => {
    sysfs = await fakeSysfs({});
    process.env.SYSFS_ROOT = sysfs;
    app = await createApp();

    const res = await request(app.getHttpServer()).get('/api/server').expect(200);
    expect(res.body).toMatchObject({ cpuTemp: null, battery: null });
  });

  it('릴리스 폴더 이름에서 커밋과 배포 시각을 꺼냄', () => {
    const release = readRelease('/home/u/portfolio/releases/20261011-144932-6cab207/apps/api');
    expect(release?.commit).toBe('6cab207');
    expect(new Date(release!.deployedAt).getTime()).toBe(new Date(2026, 9, 11, 14, 49, 32).getTime());
    expect(readRelease('/Users/me/portfolio/apps/api')).toBeNull();
  });
});

describe('high-fives', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('보낸 만큼 누적됨', async () => {
    const server = app.getHttpServer();
    const before = await request(server).get('/api/high-fives').expect(200);
    const res = await request(server).post('/api/high-fives').set('User-Agent', 'hi5-a').send({ count: 3 }).expect(200);
    expect(res.body).toEqual({ total: before.body.total + 3, accepted: 3 });
  });

  it('범위를 벗어난 횟수는 400', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/high-fives').send({ count: 0 }).expect(400);
    await request(server).post('/api/high-fives').send({ count: 11 }).expect(400);
    await request(server).post('/api/high-fives').send({ count: '3' }).expect(400);
  });

  it('한 사람이 하루 50번을 넘기면 넘친 만큼 세지 않음', async () => {
    const server = app.getHttpServer();
    const send = (count: number) =>
      request(server).post('/api/high-fives').set('User-Agent', 'hi5-limit').send({ count }).expect(200);
    for (let i = 0; i < 4; i++) await send(10);
    const almost = await send(8);
    expect(almost.body.accepted).toBe(8);
    const over = await send(5);
    expect(over.body.accepted).toBe(2);
    const blocked = await send(1);
    expect(blocked.body).toEqual({ total: over.body.total, accepted: 0 });
  });
});
