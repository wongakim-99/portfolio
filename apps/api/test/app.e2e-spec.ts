import { NotFoundException, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { readRelease } from '../src/server/server.service.js';
import { CommunityMailService } from '../src/community/community-mail.service.js';
import { CommunityStorageService } from '../src/community/community-storage.service.js';
import { configureApp } from '../src/setup.js';

const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef';
let mongo: MongoMemoryServer;
const sentMail: { kind: 'verify' | 'reset'; to: string; token: string }[] = [];
const fakeMail = {
  ready: true,
  async sendVerify(to: string, _name: string, token: string) { sentMail.push({ kind: 'verify' as const, to, token }); },
  async sendReset(to: string, _name: string, token: string) { sentMail.push({ kind: 'reset' as const, to, token }); },
};
// MinIO 대신 메모리에 사진을 보관함
const storedFiles = new Map<string, Buffer>();
const fakeStorage = {
  ready: true,
  async put(key: string, body: Buffer) { storedFiles.set(key, body); },
  async get(key: string) {
    const body = storedFiles.get(key);
    if (!body) throw new NotFoundException('사진을 찾을 수 없습니다.');
    return Readable.from([body]);
  },
  async remove(key: string) { storedFiles.delete(key); },
};

// 머리만 갖춘 사진. API 는 파일 앞부분으로 형식과 가로세로 크기만 확인함
function png(width: number, height: number): Buffer {
  const data = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(data);
  data.writeUInt32BE(13, 8);
  data.write('IHDR', 12, 'latin1');
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}
function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0', 'latin1'), Buffer.alloc(9)]);
  const sof = Buffer.alloc(19);
  sof.set([0xff, 0xc0, 0x00, 0x11, 0x08]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

// ConfigModule.forRoot 가 import 시점에 env 를 읽으므로 env 를 먼저 채우고 동적 import 함
async function createApp(): Promise<INestApplication<App>> {
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CommunityMailService).useValue(fakeMail)
    .overrideProvider(CommunityStorageService).useValue(fakeStorage)
    .compile();
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

  // Caddy 컨테이너가 붙여 넘긴 X-Forwarded-For 에서 맨 오른쪽의 공인 주소를 방문자로 봄
  it('프록시 뒤에서도 방문자를 주소별로 구분하고, 앞쪽에 끼워 넣은 주소는 무시함', async () => {
    const server = app.getHttpServer();
    const via = (forwarded: string) =>
      request(server).post('/api/views').set('User-Agent', 'visitor-xff').set('X-Forwarded-For', forwarded).expect(200);
    const first = await via('203.0.113.7, 172.18.0.1');
    const spoofed = await via('198.51.100.1, 203.0.113.7, 172.18.0.1');
    expect(spoofed.body.total).toBe(first.body.total);
    const other = await via('203.0.113.8, 172.18.0.1');
    expect(other.body.total).toBe(first.body.total + 1);
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

describe('community', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('가입, 로그인, 글과 댓글 작성에서 권한 및 신고를 확인', async () => {
    const server = app.getHttpServer();
    const register = (email: string, name: string) => request(server)
      .post('/api/community/auth/register')
      .send({ email, name, password: 'correct horse battery staple' });
    await register('writer@example.com', '글쓴이').expect(202);
    await register('reader@example.com', '독자').expect(202);
    await request(server).post('/api/community/auth/login')
      .send({ email: 'writer@example.com', password: 'correct horse battery staple' }).expect(403);
    const verifyA = sentMail.find((mail) => mail.kind === 'verify' && mail.to === 'writer@example.com')!;
    const verifyB = sentMail.find((mail) => mail.kind === 'verify' && mail.to === 'reader@example.com')!;
    const a = await request(server).post('/api/community/auth/verify').send({ token: verifyA.token }).expect(200);
    const b = await request(server).post('/api/community/auth/verify').send({ token: verifyB.token }).expect(200);
    await request(server).post('/api/community/auth/verify').send({ token: verifyA.token }).expect(400);
    const cookieA = (a.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const cookieB = (b.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect(a.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(a.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect((await request(server).get('/api/community/auth/me').expect(200)).body.user).toBeNull();
    expect((await request(server).get('/api/community/auth/me').set('Cookie', cookieA).expect(200)).body.user.name).toBe('글쓴이');

    await request(server).post('/api/community/posts').send({ title: '첫 번째 글', body: '본문은 스무 글자보다 길어야 합니다. 첫 게시글입니다.' }).expect(401);
    await request(server).post('/api/community/posts').set('Cookie', cookieA)
      .set('Origin', 'https://evil.example')
      .send({ title: '외부 요청', body: '이 요청은 다른 사이트에서 보낸 내용입니다.' }).expect(403);

    const created = await request(server).post('/api/community/posts').set('Cookie', cookieA)
      .send({ title: '첫 번째 글', body: '본문은 스무 글자보다 길어야 합니다. 첫 게시글입니다.' }).expect(201);
    const postId = created.body.post.id;
    expect((await request(server).get('/api/community/posts').expect(200)).body.posts[0].title).toBe('첫 번째 글');
    await request(server).patch(`/api/community/posts/${postId}`).set('Cookie', cookieB)
      .send({ title: '수정한 제목', body: '다른 사람의 게시글은 수정할 수 없어야 합니다.' }).expect(403);

    const comment = await request(server).post(`/api/community/posts/${postId}/comments`).set('Cookie', cookieB)
      .send({ body: '잘 읽었습니다. 좋은 글이네요.' }).expect(201);
    const commentId = comment.body.comment.id;
    expect((await request(server).get(`/api/community/posts/${postId}/comments`).expect(200)).body.comments[0].body).toContain('좋은 글');
    await request(server).patch(`/api/community/comments/${commentId}`).set('Cookie', cookieA)
      .send({ body: '다른 사람 댓글 수정' }).expect(403);

    await request(server).post('/api/community/reports').set('Cookie', cookieA)
      .send({ targetType: 'comment', targetId: commentId, reason: 'spam' }).expect(204);
    await request(server).post('/api/community/reports').set('Cookie', cookieA)
      .send({ targetType: 'comment', targetId: commentId, reason: 'spam' }).expect(409);
    await request(server).get('/api/community/admin/reports').expect(401);
    const reports = await request(server).get('/api/community/admin/reports')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(200);
    expect(reports.body.reports[0]).toMatchObject({ targetType: 'comment', targetId: commentId, reason: 'spam' });

    await request(server).delete(`/api/community/admin/comments/${commentId}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(204);
    expect((await request(server).get(`/api/community/posts/${postId}`).expect(200)).body.commentCount).toBe(0);
    const afterModeration = await request(server).get('/api/community/admin/reports')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(200);
    expect(afterModeration.body.reports).toEqual([]);
    await request(server).delete(`/api/community/posts/${postId}`).set('Cookie', cookieB).expect(403);
    await request(server).delete(`/api/community/posts/${postId}`).set('Cookie', cookieA).expect(204);
    await request(server).get(`/api/community/posts/${postId}`).expect(404);
  });

  it('비밀번호 변경은 기존 다른 세션을 해제', async () => {
    const server = app.getHttpServer();
    const second = await request(server).post('/api/community/auth/login')
      .send({ email: 'reader@example.com', password: 'correct horse battery staple' }).expect(200);
    const oldCookie = (second.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const first = await request(server).post('/api/community/auth/login')
      .send({ email: 'reader@example.com', password: 'correct horse battery staple' }).expect(200);
    const currentCookie = (first.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await request(server).post('/api/community/auth/password').set('Cookie', currentCookie)
      .send({ currentPassword: 'correct horse battery staple', newPassword: 'another long password 2026' }).expect(204);
    expect((await request(server).get('/api/community/auth/me').set('Cookie', oldCookie).expect(200)).body.user).toBeNull();
    await request(server).post('/api/community/auth/login')
      .send({ email: 'reader@example.com', password: 'correct horse battery staple' }).expect(401);
    await request(server).post('/api/community/auth/login')
      .send({ email: 'reader@example.com', password: 'another long password 2026' }).expect(200);
  });

  it('비밀번호 재설정 링크는 한 번만 사용하고 모든 세션을 해제', async () => {
    const server = app.getHttpServer();
    const login = await request(server).post('/api/community/auth/login')
      .set('X-Forwarded-For', '203.0.113.99, 172.18.0.1')
      .send({ email: 'writer@example.com', password: 'correct horse battery staple' }).expect(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await request(server).post('/api/community/auth/reset-request')
      .send({ email: 'writer@example.com' }).expect(202);
    const token = sentMail.findLast((mail) => mail.kind === 'reset' && mail.to === 'writer@example.com')!.token;
    await request(server).post('/api/community/auth/reset')
      .send({ token, newPassword: 'new verified password 2026' }).expect(204);
    await request(server).post('/api/community/auth/reset')
      .send({ token, newPassword: 'another reset password' }).expect(400);
    expect((await request(server).get('/api/community/auth/me').set('Cookie', cookie).expect(200)).body.user).toBeNull();
    await request(server).post('/api/community/auth/login')
      .set('X-Forwarded-For', '203.0.113.99, 172.18.0.1')
      .send({ email: 'writer@example.com', password: 'new verified password 2026' }).expect(200);
  });

  it('내 페이지: 사진은 형식과 크기를 확인해 바꾸고, 이름을 바꾸면 글에도 반영', async () => {
    const server = app.getHttpServer();
    // 앞선 테스트가 기본 주소의 요청 한도를 써 버려서 다른 주소로 보냄
    const ip = '203.0.113.120, 172.18.0.1';
    await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
      .send({ email: 'photo@example.com', name: '사진주인', password: 'correct horse battery staple' }).expect(202);
    const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === 'photo@example.com')!.token;
    const verified = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
    const cookie = (verified.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const id = verified.body.user.id;
    expect(verified.body.user.avatarUrl).toBeNull();
    await request(server).post('/api/community/posts').set('X-Forwarded-For', ip).set('Cookie', cookie)
      .send({ title: '사진 올린 사람의 글', body: '프로필 사진이 글 목록에도 보이는지 확인합니다.' }).expect(201);

    const upload = (body: Buffer, type = 'image/png') => request(server).put('/api/community/me/avatar')
      .set('X-Forwarded-For', ip).set('Cookie', cookie).set('Content-Type', type).send(body);
    await request(server).put('/api/community/me/avatar').set('X-Forwarded-For', ip)
      .set('Content-Type', 'image/png').send(png(64, 64)).expect(401);
    await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')).expect(415);
    await upload(png(4000, 10)).expect(400);
    await upload(Buffer.alloc(1024 * 1024 + 1)).expect(413);
    const first = await upload(png(64, 64)).expect(200);
    expect(first.body.avatarUrl).toMatch(new RegExp(`^/api/community/avatars/${id}-[a-f0-9]{16}\\.png$`));
    const image = await request(server).get(first.body.avatarUrl).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cache-control']).toContain('immutable');

    // 새 사진을 올리면 옛 사진은 저장소에서 지움. 파일 이름의 형식은 올린 내용으로 정함
    const second = await upload(jpeg(512, 512), 'image/webp').expect(200);
    expect(second.body.avatarUrl).toMatch(/\.jpg$/);
    await request(server).get(first.body.avatarUrl).expect(404);
    expect([...storedFiles.keys()].filter((key) => key.includes(id))).toHaveLength(1);

    await request(server).patch('/api/community/me/profile').set('X-Forwarded-For', ip)
      .send({ name: '새 이름', bio: '' }).expect(401);
    const updated = await request(server).patch('/api/community/me/profile').set('X-Forwarded-For', ip).set('Cookie', cookie)
      .send({ name: '  새   이름 ', bio: '  집 노트북으로 서버를 돌립니다.  ' }).expect(200);
    expect(updated.body.user).toMatchObject({ id, name: '새 이름', bio: '집 노트북으로 서버를 돌립니다.', avatarUrl: second.body.avatarUrl, postCount: 1 });
    const publicProfile = await request(server).get(`/api/community/users/${id}`).expect(200);
    expect(publicProfile.body).not.toHaveProperty('email');
    const mine = await request(server).get(`/api/community/posts?author=${id}`).expect(200);
    expect(mine.body.posts).toHaveLength(1);
    expect(mine.body.posts[0]).toMatchObject({ authorName: '새 이름', authorAvatarUrl: second.body.avatarUrl });
    expect((await request(server).get('/api/community/auth/me').set('Cookie', cookie).expect(200)).body.user.avatarUrl)
      .toBe(second.body.avatarUrl);

    await request(server).delete('/api/community/me/avatar').set('Cookie', cookie).expect(204);
    await request(server).get(second.body.avatarUrl).expect(404);
    expect((await request(server).get(`/api/community/users/${id}`).expect(200)).body.avatarUrl).toBeNull();
    await request(server).get('/api/community/avatars/..%2F..%2Fsecret.png').expect(404);
    await request(server).get('/api/community/users/000000000000000000000000').expect(404);
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

  it('이미지에 넣어 둔 커밋과 빌드 시각을 꺼냄', () => {
    expect(readRelease({ RELEASE_COMMIT: '6cab207f4a71', RELEASE_BUILT_AT: '2026-10-11T05:49:32Z' })).toEqual({
      commit: '6cab207',
      deployedAt: '2026-10-11T05:49:32.000Z',
    });
    expect(readRelease({ RELEASE_COMMIT: 'af15ab4', RELEASE_BUILT_AT: 'nope' })).toEqual({ commit: 'af15ab4', deployedAt: null });
    expect(readRelease({})).toBeNull();
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
