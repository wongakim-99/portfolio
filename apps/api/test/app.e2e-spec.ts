import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { App } from 'supertest/types.js';
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
